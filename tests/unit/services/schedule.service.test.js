const { v4: uuidv4 } = require('uuid');

jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid-fixed') }));
jest.mock('../../../src/config/database', () => ({
  prepare: jest.fn(),
  transaction: jest.fn(fn => (...args) => fn(...args)),
}));

const db = require('../../../src/config/database');

// resetAllMocks evita que mockReturnValueOnce de um teste com falha
// contamine o próximo (clearMocks não limpa a fila de retorno único).
beforeEach(() => jest.resetAllMocks());
const { makeStmt } = require('../helpers/db-mock');
const {
  getSchedule,
  getAssignment,
  reassignTask,
  completeTask,
  reportImpediment,
} = require('../../../src/services/schedule.service');

const fakeAssignment = {
  id: 'a1', house_id: 'h1', task_id: 't1', task_name: 'Varrer',
  assigned_to: 'u1', assigned_to_name: 'Ana',
  scheduled_date: '2024-07-01', status: 'pending',
  completed_at: null, completion_notes: null,
  group_id: null, sequence_order: 0,
  distribution_period: 'semana-1',
};

// ─── getSchedule ──────────────────────────────────────────────────────────────

describe('getSchedule', () => {
  test('SC01 – resident só vê as próprias tarefas (filtro automático por role)', () => {
    const list = [fakeAssignment];
    db.prepare.mockReturnValueOnce(makeStmt({ all: list }));

    const result = getSchedule({ houseId: 'h1', userId: 'u1', role: 'resident', dateFrom: null, dateTo: null, assignedTo: null });

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('assigned_to');
    expect(result).toEqual(list);
  });

  test('SC02 – admin pode filtrar por assignedTo', () => {
    const list = [fakeAssignment];
    db.prepare.mockReturnValueOnce(makeStmt({ all: list }));

    const result = getSchedule({ houseId: 'h1', userId: 'u1', role: 'admin', dateFrom: '2024-07-01', dateTo: '2024-07-07', assignedTo: 'u2' });

    expect(result).toEqual(list);
  });

  test('SC03 – sem filtros retorna todas as tarefas da casa (admin)', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ all: [] }));

    const result = getSchedule({ houseId: 'h1', userId: 'u1', role: 'admin', dateFrom: null, dateTo: null, assignedTo: null });

    expect(result).toHaveLength(0);
  });
});

// ─── getAssignment ────────────────────────────────────────────────────────────

describe('getAssignment', () => {
  test('SC04 – retorna atribuição existente', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: fakeAssignment }));

    const result = getAssignment('a1', 'h1');
    expect(result.id).toBe('a1');
  });

  test('SC05 – lança 404 se atribuição não existe', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { getAssignment('xxx', 'h1'); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });
});

// ─── reassignTask ─────────────────────────────────────────────────────────────

describe('reassignTask', () => {
  test('SC06 – reatribui tarefa com sucesso', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeAssignment }))          // getAssignment
      .mockReturnValueOnce(makeStmt({ get: { id: 'm2' } }))           // is member
      .mockReturnValueOnce(makeStmt({ get: null }))                   // no physical limitation
      .mockReturnValueOnce(makeStmt())                                // UPDATE
      .mockReturnValueOnce(makeStmt({ get: { ...fakeAssignment, assigned_to: 'u2' } })); // getAssignment após

    const result = reassignTask({ assignmentId: 'a1', houseId: 'h1', newUserId: 'u2' });
    expect(result).toBeDefined();
  });

  test('SC07 – lança 400 se tarefa já está concluída', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: { ...fakeAssignment, status: 'completed' } }));

    let err;
    try { reassignTask({ assignmentId: 'a1', houseId: 'h1', newUserId: 'u2' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/concluída/);
  });

  test('SC08 – lança 400 se novo responsável não é membro da casa', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeAssignment }))
      .mockReturnValueOnce(makeStmt({ get: null })); // não é membro

    let err;
    try { reassignTask({ assignmentId: 'a1', houseId: 'h1', newUserId: 'u99' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/membro/);
  });

  test('SC09 – retorna warning quando novo responsável tem limitação física (RN03 não bloqueia reatribuição manual)', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeAssignment }))
      .mockReturnValueOnce(makeStmt({ get: { id: 'm2' } }))
      .mockReturnValueOnce(makeStmt({ get: { has_physical_limitation: 1 } })) // tem limitação
      .mockReturnValueOnce(makeStmt())                                         // UPDATE assigned_to
      .mockReturnValueOnce(makeStmt({ get: { ...fakeAssignment, assigned_to: 'u2' } })); // getAssignment após

    const result = reassignTask({ assignmentId: 'a1', houseId: 'h1', newUserId: 'u2' });

    expect(result.warning).toMatch(/limitação física/);
    expect(result.assigned_to).toBe('u2');
  });
});

// ─── completeTask ─────────────────────────────────────────────────────────────

describe('completeTask', () => {
  test('SC10 – marca tarefa como concluída com observação', () => {
    const completedAssignment = { ...fakeAssignment, status: 'completed', completion_notes: 'ok' };
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeAssignment }))          // getAssignment
      .mockReturnValueOnce(makeStmt({ get: { id: 'm1' } }))            // member check
      .mockReturnValueOnce(makeStmt())                                 // UPDATE
      .mockReturnValueOnce(makeStmt({ get: completedAssignment }));    // getAssignment após

    const result = completeTask({ assignmentId: 'a1', houseId: 'h1', userId: 'u1', completionNotes: 'ok' });

    expect(result.status).toBe('completed');
    expect(result.completion_notes).toBe('ok');
  });

  test('SC11 – lança 400 se tarefa já está concluída', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: { ...fakeAssignment, status: 'completed' } }));

    let err;
    try { completeTask({ assignmentId: 'a1', houseId: 'h1', userId: 'u1', completionNotes: null }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
  });

  test('SC10b – conclui tarefa sem notas (completionNotes null → branch ||)', () => {
    const completedAssignment = { ...fakeAssignment, status: 'completed', completion_notes: null };
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeAssignment }))
      .mockReturnValueOnce(makeStmt({ get: { id: 'm1' } }))  // member check
      .mockReturnValueOnce(makeStmt())
      .mockReturnValueOnce(makeStmt({ get: completedAssignment }));

    const result = completeTask({ assignmentId: 'a1', houseId: 'h1', userId: 'u1', completionNotes: null });
    expect(result.status).toBe('completed');
    expect(result.completion_notes).toBeNull();
  });

  test('SC12 – lança 403 se usuário não é membro da casa', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeAssignment }))  // getAssignment
      .mockReturnValueOnce(makeStmt({ get: null }));           // member check → null → 403

    let err;
    try { completeTask({ assignmentId: 'a1', houseId: 'h1', userId: 'u99', completionNotes: null }); }
    catch (e) { err = e; }

    expect(err.status).toBe(403);
    expect(err.message).toMatch(/membro/);
  });
});

// ─── reportImpediment ─────────────────────────────────────────────────────────

describe('reportImpediment', () => {
  test('SC13 – redistribui tarefa para membro com menor carga (RN04)', () => {
    const newAssignment = { ...fakeAssignment, id: 'a2', assigned_to: 'u2' };

    // Sequência exata de db.prepare no reportImpediment (1 membro elegível u2):
    // [1] getAssignment  [2] UPDATE redistributed  [3] SELECT members
    // [4] limitação u2   [5] COUNT total tasks  [6] SELECT all house members (usingEqual)
    // [7] COUNT carga u2 (bestMember loop)  [8] COUNT carga u2 (allAtLimit loop)
    // [9] INSERT nova atribuição  [10] INSERT notification  [11] getAssignment final
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeAssignment }))
      .mockReturnValueOnce(makeStmt())
      .mockReturnValueOnce(makeStmt({ all: [{ user_id: 'u2', weight_percentage: 50, role: 'resident' }] }))
      .mockReturnValueOnce(makeStmt({ get: null }))                              // u2 sem limitação
      .mockReturnValueOnce(makeStmt({ get: { cnt: 5 } }))                        // total tasks
      .mockReturnValueOnce(makeStmt({ all: [{ user_id: 'u1', weight_percentage: 50 }, { user_id: 'u2', weight_percentage: 50 }] })) // all house members
      .mockReturnValueOnce(makeStmt({ get: { cnt: 2 } }))                        // carga u2 (bestMember loop)
      .mockReturnValueOnce(makeStmt({ get: { cnt: 2 } }))                        // carga u2 (allAtLimit loop) → 2 >= 2.5? false
      .mockReturnValueOnce(makeStmt())                                            // INSERT nova atribuição
      .mockReturnValueOnce(makeStmt())                                            // INSERT notification (createNotification)
      .mockReturnValueOnce(makeStmt({ get: newAssignment }));                    // getAssignment final

    const result = reportImpediment({ assignmentId: 'a1', houseId: 'h1', userId: 'u1' });

    expect(result.assigned_to).toBe('u2');
  });

  test('SC14 – lança 403 se tarefa não pertence ao usuário', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: { ...fakeAssignment, assigned_to: 'u99' } }));

    let err;
    try { reportImpediment({ assignmentId: 'a1', houseId: 'h1', userId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(403);
  });

  test('SC15 – lança 400 se tarefa já foi concluída', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: { ...fakeAssignment, status: 'completed' } }));

    let err;
    try { reportImpediment({ assignmentId: 'a1', houseId: 'h1', userId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
  });

  test('SC13b – mantém membro com menor carga entre múltiplos elegíveis (branch load >= bestLoad)', () => {
    const newAssignment = { ...fakeAssignment, id: 'a2', assigned_to: 'u2' };

    // Sequência com 2 elegíveis [u2, u3]:
    // [1] getAssignment  [2] UPDATE redistributed  [3] SELECT members
    // [4] limitação u2  [5] limitação u3
    // [6] COUNT total tasks  [7] SELECT all house members (usingEqual)
    // [8] COUNT carga u2 (bestMember loop) → 1  [9] COUNT carga u3 (bestMember loop) → 5 ≥ 1? false → u2 permanece
    // [10] COUNT carga u2 (allAtLimit loop) → 1 ≥ target? false → every para aqui (short-circuit)
    // [11] INSERT nova  [12] INSERT notification  [13] getAssignment final
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeAssignment }))
      .mockReturnValueOnce(makeStmt())
      .mockReturnValueOnce(makeStmt({ all: [
        { user_id: 'u2', weight_percentage: 50, role: 'resident' },
        { user_id: 'u3', weight_percentage: 50, role: 'resident' },
      ]}))
      .mockReturnValueOnce(makeStmt({ get: null }))   // u2 sem limitação
      .mockReturnValueOnce(makeStmt({ get: null }))   // u3 sem limitação
      .mockReturnValueOnce(makeStmt({ get: { cnt: 10 } }))  // total tasks
      .mockReturnValueOnce(makeStmt({ all: [{ user_id: 'u1', weight_percentage: 50 }, { user_id: 'u2', weight_percentage: 50 }] })) // all house members
      .mockReturnValueOnce(makeStmt({ get: { cnt: 1 } }))   // carga u2 (bestMember loop) → bestLoad=1, bestMember=u2
      .mockReturnValueOnce(makeStmt({ get: { cnt: 5 } }))   // carga u3 (bestMember loop) → 5 < 1? false → branch!
      .mockReturnValueOnce(makeStmt({ get: { cnt: 1 } }))   // carga u2 (allAtLimit loop) → 1 ≥ 5? false → every para
      .mockReturnValueOnce(makeStmt())                       // INSERT nova atribuição
      .mockReturnValueOnce(makeStmt())                       // INSERT notification
      .mockReturnValueOnce(makeStmt({ get: newAssignment })); // getAssignment final

    const result = reportImpediment({ assignmentId: 'a1', houseId: 'h1', userId: 'u1' });
    expect(result.assigned_to).toBe('u2');
  });

  test('SC16 – lança 400 quando não há membros elegíveis para redistribuição', () => {
    const prefComLimitacao = { has_physical_limitation: 1 };

    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeAssignment }))
      .mockReturnValueOnce(makeStmt())
      .mockReturnValueOnce(makeStmt({ all: [{ user_id: 'u2', weight_percentage: 50, role: 'resident' }] }))
      .mockReturnValueOnce(makeStmt({ get: prefComLimitacao })); // u2 tem limitação

    let err;
    try { reportImpediment({ assignmentId: 'a1', houseId: 'h1', userId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/elegível/);
  });
});
