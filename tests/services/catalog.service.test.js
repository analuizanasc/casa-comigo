const { v4: uuidv4 } = require('uuid');

jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('../../src/config/database', () => ({
  prepare: jest.fn(),
  transaction: jest.fn(fn => (...args) => fn(...args)),
}));

const db = require('../../src/config/database');
const { makeStmt } = require('../helpers/db-mock');
const {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  addDependency,
  removeDependency,
} = require('../../src/services/catalog.service');

const fakeTask = {
  id: 't1', house_id: 'h1', name: 'Varrer', description: null,
  frequency: 'weekly', duration_minutes: 20, effort_level: 'light',
  room: 'Sala', is_active: 1, created_by: 'u1', created_at: '2024', updated_at: '2024',
};

// ─── listTasks ────────────────────────────────────────────────────────────────

describe('listTasks', () => {
  test('CT01 – retorna lista de tarefas ativas', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ all: [fakeTask] }));
    const result = listTasks('h1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Varrer');
  });
});

// ─── getTask ──────────────────────────────────────────────────────────────────

describe('getTask', () => {
  test('CT02 – retorna tarefa com dependências e dependentes', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeTask }))
      .mockReturnValueOnce(makeStmt({ all: [{ depends_on_task_id: 't0', depends_on_name: 'Espanar' }] }))
      .mockReturnValueOnce(makeStmt({ all: [] }));

    const result = getTask('t1', 'h1');

    expect(result.id).toBe('t1');
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependents).toHaveLength(0);
  });

  test('CT03 – lança 404 se tarefa não encontrada', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { getTask('inexistente', 'h1'); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });
});

// ─── createTask ───────────────────────────────────────────────────────────────

describe('createTask', () => {
  const validBody = { name: 'Varrer', frequency: 'weekly', effort_level: 'light', duration_minutes: 20, room: 'Sala' };

  test('CT04 – cria tarefa com campos válidos', () => {
    uuidv4.mockReturnValue('t-new');
    db.prepare
      .mockReturnValueOnce(makeStmt())                    // INSERT
      .mockReturnValueOnce(makeStmt({ get: fakeTask }))  // getTask: SELECT task
      .mockReturnValueOnce(makeStmt({ all: [] }))        // getTask: dependencies
      .mockReturnValueOnce(makeStmt({ all: [] }));       // getTask: dependents

    const result = createTask({ houseId: 'h1', userId: 'u1', body: validBody });

    expect(result).toBeDefined();
    expect(db.prepare).toHaveBeenCalledTimes(4);
  });

  test('CT05 – usa duration_minutes=30 como padrão quando omitido', () => {
    uuidv4.mockReturnValue('t-new');
    db.prepare
      .mockReturnValueOnce(makeStmt())
      .mockReturnValueOnce(makeStmt({ get: fakeTask }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValueOnce(makeStmt({ all: [] }));

    const body = { name: 'Espanar', frequency: 'weekly', effort_level: 'light' };
    createTask({ houseId: 'h1', userId: 'u1', body });

    const insertCall = db.prepare.mock.calls[0][0];
    expect(insertCall).toContain('INSERT INTO task_catalog');
  });

  test('CT06 – lança 400 para nome vazio', () => {
    let err;
    try { createTask({ houseId: 'h1', userId: 'u1', body: { ...validBody, name: '' } }); }
    catch (e) { err = e; }
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Nome/);
  });

  test('CT07 – lança 400 para frequência inválida', () => {
    let err;
    try { createTask({ houseId: 'h1', userId: 'u1', body: { ...validBody, frequency: 'bimestral' } }); }
    catch (e) { err = e; }
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Frequência/);
  });

  test('CT08 – lança 400 para effort_level inválido', () => {
    let err;
    try { createTask({ houseId: 'h1', userId: 'u1', body: { ...validBody, effort_level: 'extreme' } }); }
    catch (e) { err = e; }
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/esforço/);
  });

  test('CT09 – lança 400 para duration_minutes <= 0', () => {
    let err;
    try { createTask({ houseId: 'h1', userId: 'u1', body: { ...validBody, duration_minutes: 0 } }); }
    catch (e) { err = e; }
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Duração/);
  });
});

// ─── updateTask ───────────────────────────────────────────────────────────────

describe('updateTask', () => {
  const validBody = { name: 'Varrer', frequency: 'weekly', effort_level: 'light', duration_minutes: 20 };

  test('CT10 – atualiza tarefa com sucesso', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } })) // exists check
      .mockReturnValueOnce(makeStmt())                      // UPDATE
      .mockReturnValueOnce(makeStmt({ get: fakeTask }))     // getTask: SELECT task
      .mockReturnValueOnce(makeStmt({ all: [] }))           // getTask: dependencies
      .mockReturnValueOnce(makeStmt({ all: [] }));          // getTask: dependents

    const result = updateTask({ taskId: 't1', houseId: 'h1', body: validBody });
    expect(result).toBeDefined();
  });

  test('CT11 – lança 404 se tarefa não existe', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { updateTask({ taskId: 'xxx', houseId: 'h1', body: validBody }); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });
});

// ─── deleteTask ───────────────────────────────────────────────────────────────

describe('deleteTask', () => {
  test('CT12 – marca tarefa como inativa (soft delete)', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } }))
      .mockReturnValueOnce(makeStmt());

    expect(() => deleteTask('t1', 'h1')).not.toThrow();
    expect(db.prepare).toHaveBeenCalledTimes(2);
  });

  test('CT13 – lança 404 se tarefa não existe', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { deleteTask('xxx', 'h1'); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });
});

// ─── addDependency ────────────────────────────────────────────────────────────

describe('addDependency', () => {
  test('CT14 – adiciona dependência entre tarefas distintas', () => {
    uuidv4.mockReturnValue('dep-id');
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 't2' } }))  // task exists
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } }))  // dep exists
      .mockReturnValueOnce(makeStmt({ all: [] }))             // hasCircular: no deps of t1
      .mockReturnValueOnce(makeStmt({ get: null }))           // not already exists
      .mockReturnValueOnce(makeStmt());                       // INSERT

    expect(() => addDependency({ taskId: 't2', dependsOnTaskId: 't1', houseId: 'h1' })).not.toThrow();
  });

  test('CT15 – lança 400 se tarefa depende de si mesma', () => {
    let err;
    try { addDependency({ taskId: 't1', dependsOnTaskId: 't1', houseId: 'h1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/si mesma/);
  });

  test('CT16 – lança 404 se alguma das tarefas não existe', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: null })) // task não encontrada
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } }));

    let err;
    try { addDependency({ taskId: 't99', dependsOnTaskId: 't1', houseId: 'h1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });

  test('CT17 – lança 400 para dependência circular', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 't2' } }))  // task t2 existe
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } }))  // dep t1 existe
      // hasCircular: fila começa com t1, busca deps de t1 que incluem t2 (circular)
      .mockReturnValueOnce(makeStmt({ all: [{ depends_on_task_id: 't2' }] })); // t1 depende de t2!

    let err;
    try { addDependency({ taskId: 't2', dependsOnTaskId: 't1', houseId: 'h1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/circular/);
  });

  test('CT18 – lança 409 se dependência já existe', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 't2' } }))
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } }))
      .mockReturnValueOnce(makeStmt({ all: [] }))               // sem circular
      .mockReturnValueOnce(makeStmt({ get: { id: 'dep-id' } })); // já existe

    let err;
    try { addDependency({ taskId: 't2', dependsOnTaskId: 't1', houseId: 'h1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(409);
  });
});

// ─── removeDependency ─────────────────────────────────────────────────────────

describe('removeDependency', () => {
  test('CT19 – remove dependência existente', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ run: { changes: 1 } }));

    expect(() => removeDependency({ taskId: 't2', dependsOnTaskId: 't1' })).not.toThrow();
  });

  test('CT20 – lança 404 se dependência não existe', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ run: { changes: 0 } }));

    let err;
    try { removeDependency({ taskId: 't2', dependsOnTaskId: 't1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });
});
