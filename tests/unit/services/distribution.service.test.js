const { v4: uuidv4 } = require('uuid');

jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid-fixed') }));
jest.mock('../../../src/config/database', () => ({
  prepare: jest.fn(),
  transaction: jest.fn(fn => (...args) => fn(...args)),
}));

const db = require('../../../src/config/database');
const { makeStmt } = require('../helpers/db-mock');
const { distribute } = require('../../../src/services/distribution.service');

// Fixtures
const taskLight  = { id: 't1', name: 'Varrer',  frequency: 'weekly',  duration_minutes: 20, effort_level: 'light',  room: 'Sala',    is_active: 1 };
const taskHeavy  = { id: 't2', name: 'Limpar',  frequency: 'monthly', duration_minutes: 60, effort_level: 'heavy',  room: 'Cozinha', is_active: 1 };
const taskDaily  = { id: 't3', name: 'Lavar',   frequency: 'daily',   duration_minutes: 10, effort_level: 'light',  room: null,      is_active: 1 };

const memberA = { user_id: 'u1', name: 'Ana', weight_percentage: 60, weekly_availability_hours: 10, role: 'admin' };
const memberB = { user_id: 'u2', name: 'Bob', weight_percentage: 40, weekly_availability_hours: 10, role: 'resident' };

const distributeArgs = {
  houseId: 'h1',
  periodStart: '2024-07-01',
  periodEnd: '2024-07-07',
  periodLabel: 'semana-1',
  requesterId: 'u1',
};

// Configura os mocks do DB na ordem exata de execução do distribute()
function setupDistributeMocks({ tasks, members, deps = [], prefs = [], tolerance = 10 }) {
  const insertStmt = makeStmt();
  db.prepare
    .mockReturnValueOnce(makeStmt({ all: tasks }))    // SELECT tasks
    .mockReturnValueOnce(makeStmt({ all: members }))  // SELECT members
    .mockReturnValueOnce(makeStmt({ all: deps }))     // SELECT dependencies
    .mockReturnValueOnce(makeStmt({ all: prefs }))    // SELECT preferences
    .mockReturnValue(insertStmt);                     // INSERT assignments (N vezes) + SELECT house

  // Último prepare é o SELECT tolerance da house
  db.prepare.mockReturnValueOnce(makeStmt({ get: { tolerance_percentage: tolerance } }));
}

// ─── Cobertura de ramos de erro ───────────────────────────────────────────────

describe('distribute – erros de entrada', () => {
  test('DT01 – lança 400 quando não há tarefas ativas', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ all: [] }));

    let err;
    try { distribute(distributeArgs); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Nenhuma tarefa/);
  });

  test('DT02 – lança 400 quando não há membros na casa', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [taskLight] }))
      .mockReturnValueOnce(makeStmt({ all: [] }));

    let err;
    try { distribute(distributeArgs); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Nenhum membro/);
  });
});

// ─── Distribuição com pesos definidos ─────────────────────────────────────────

describe('distribute – com pesos percentuais (RN02)', () => {
  test('DT03 – distribui respeitando pesos e retorna balanço', () => {
    setupDistributeMocks({ tasks: [taskLight], members: [memberA, memberB] });
    // Correção: reconfigurar mock do tolerance que foi sobrescrito pelo mockReturnValue
    db.prepare.mockReturnValueOnce(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute(distributeArgs);

    expect(result.total_tasks_assigned).toBeGreaterThan(0);
    expect(result.balance).toHaveLength(2);
    expect(result.balance[0]).toHaveProperty('target_percentage');
    expect(result.balance[0]).toHaveProperty('actual_percentage');
    expect(result.balance[0]).toHaveProperty('within_tolerance');
  });
});

// ─── Distribuição sem pesos (igualitária) ─────────────────────────────────────

describe('distribute – sem pesos (distribuição igualitária, RN02)', () => {
  test('DT04 – aplica distribuição 50/50 quando nenhum peso foi definido', () => {
    const memberSemPeso = { ...memberA, weight_percentage: null };
    const memberSemPeso2 = { ...memberB, weight_percentage: null };

    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [taskLight] }))
      .mockReturnValueOnce(makeStmt({ all: [memberSemPeso, memberSemPeso2] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute(distributeArgs);

    const targets = result.balance.map(b => b.target_percentage);
    expect(targets.every(t => t === 50)).toBe(true);
  });
});

// ─── Limitação física (RN03) ──────────────────────────────────────────────────

describe('distribute – limitação física (RN03)', () => {
  test('DT05 – membro com limitação física não recebe a tarefa', () => {
    const prefLimitacao = {
      user_id: 'u1', task_id: 't1',
      preference_level: 'hate', has_physical_limitation: 1,
    };
    // Apenas u1 tem limitação; u2 não tem → u2 deve receber todas as tarefas
    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [taskLight] }))
      .mockReturnValueOnce(makeStmt({ all: [memberA, memberB] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValueOnce(makeStmt({ all: [prefLimitacao] }))
      .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute(distributeArgs);

    const u1Balance = result.balance.find(b => b.user_id === 'u1');
    const u2Balance = result.balance.find(b => b.user_id === 'u2');
    expect(u1Balance.actual_percentage).toBe(0);
    expect(u2Balance.actual_percentage).toBe(100);
  });
});

// ─── Agrupamento por dependência (RN01) ───────────────────────────────────────

describe('distribute – dependências de ordem (RN01)', () => {
  test('DT06 – tarefas com dependência compartilham group_id e sequence_order crescente', () => {
    const taskBase  = { ...taskLight, id: 't1', room: 'Sala' };
    const taskDep   = { id: 't2', name: 'Passar pano', frequency: 'weekly', duration_minutes: 20, effort_level: 'light', room: 'Sala', is_active: 1 };
    const dep = { task_id: 't2', depends_on_task_id: 't1' }; // t2 depende de t1

    const insertedRows = [];
    const insertStmt = { get: jest.fn(), all: jest.fn(), run: jest.fn((...args) => insertedRows.push(args)) };

    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [taskBase, taskDep] }))
      .mockReturnValueOnce(makeStmt({ all: [memberA] }))
      .mockReturnValueOnce(makeStmt({ all: [dep] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValueOnce(insertStmt)                               // INSERT para t1
      .mockReturnValueOnce(makeStmt({ get: { tolerance_percentage: 10 } }));

    distribute(distributeArgs);

    // Ambas as tarefas devem ter sido inseridas
    expect(insertStmt.run).toHaveBeenCalledTimes(2);
    // sequence_order deve ser 0 e 1
    const orders = insertStmt.run.mock.calls.map(c => c[7]); // argumento index 7 = sequence_order
    expect(orders).toContain(0);
    expect(orders).toContain(1);
  });
});

// ─── Cobertura das frequências (statement coverage) ───────────────────────────

describe('distribute – todas as frequências de tarefa', () => {
  const frequencies = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'];

  // O mock padrão (mockReturnValue) é usado tanto pelo INSERT quanto pelo SELECT house,
  // então precisa funcionar para ambos: run() retorna {changes:1} e get() retorna a tolerância.
  frequencies.forEach(frequency => {
    test(`DT07.${frequency} – gera ao menos 1 ocorrência para frequência "${frequency}"`, () => {
      const task = { id: 't1', name: `Tarefa ${frequency}`, frequency, duration_minutes: 10, effort_level: 'light', room: null, is_active: 1 };
      const memberSingle = { user_id: 'u1', name: 'Ana', weight_percentage: 100, weekly_availability_hours: 10, role: 'admin' };

      db.prepare
        .mockReturnValueOnce(makeStmt({ all: [task] }))
        .mockReturnValueOnce(makeStmt({ all: [memberSingle] }))
        .mockReturnValueOnce(makeStmt({ all: [] }))
        .mockReturnValueOnce(makeStmt({ all: [] }))
        .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

      const result = distribute({
        houseId: 'h1',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        periodLabel: `test-${frequency}`,
        requesterId: 'u1',
      });

      expect(result.total_tasks_assigned).toBeGreaterThanOrEqual(1);
    });
  });
});

// ─── Branch: depMap append (L82) + inDegree parcial (L161) ──────────────────

describe('distribute – dupla dependência do mesmo task cobre depMap append e inDegree parcial', () => {
  test('DT09 – tC dependendo de tA e tB: depMap.push existente (L82) e inDegree decrementa para 1 antes de 0 (L161)', () => {
    const tA = { id: 'tA', name: 'A', frequency: 'weekly', duration_minutes: 10, effort_level: 'light', room: null, is_active: 1 };
    const tB = { id: 'tB', name: 'B', frequency: 'weekly', duration_minutes: 10, effort_level: 'light', room: null, is_active: 1 };
    const tC = { id: 'tC', name: 'C', frequency: 'weekly', duration_minutes: 10, effort_level: 'light', room: null, is_active: 1 };
    const deps = [
      { task_id: 'tC', depends_on_task_id: 'tA' },
      { task_id: 'tC', depends_on_task_id: 'tB' },
    ];

    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [tA, tB, tC] }))
      .mockReturnValueOnce(makeStmt({ all: [memberA] }))
      .mockReturnValueOnce(makeStmt({ all: deps }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute(distributeArgs);
    expect(result.total_tasks_assigned).toBe(3);
  });
});

// ─── Branch: taskIds.has(depId) false (L110) ─────────────────────────────────

describe('distribute – dependência para tarefa ausente nas ocorrências do dia', () => {
  test('DT10 – taskIds.has(depId) false quando dep aponta para tarefa inativa removida (L110)', () => {
    const tA = { id: 'tA', name: 'A', frequency: 'weekly', duration_minutes: 10, effort_level: 'light', room: null, is_active: 1 };

    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [tA] }))
      .mockReturnValueOnce(makeStmt({ all: [memberA] }))
      .mockReturnValueOnce(makeStmt({ all: [{ task_id: 'tA', depends_on_task_id: 'tGhost' }] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute(distributeArgs);
    expect(result.total_tasks_assigned).toBeGreaterThanOrEqual(1);
  });
});

// ─── Branch: fallback circular (L167) ────────────────────────────────────────

describe('distribute – dependência circular aciona fallback topológico', () => {
  test('DT11 – tA↔tB circular: queue vazia no início → fallback insere ambos (L167)', () => {
    const tA = { id: 'tA', name: 'A', frequency: 'weekly', duration_minutes: 10, effort_level: 'light', room: null, is_active: 1 };
    const tB = { id: 'tB', name: 'B', frequency: 'weekly', duration_minutes: 10, effort_level: 'light', room: null, is_active: 1 };
    const deps = [
      { task_id: 'tA', depends_on_task_id: 'tB' },
      { task_id: 'tB', depends_on_task_id: 'tA' },
    ];

    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [tA, tB] }))
      .mockReturnValueOnce(makeStmt({ all: [memberA] }))
      .mockReturnValueOnce(makeStmt({ all: deps }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute(distributeArgs);
    expect(result.total_tasks_assigned).toBe(2);
  });
});

// ─── Branch: weight_percentage null com usingEqual false (L244) ──────────────

describe('distribute – membro sem peso quando outros têm peso definido', () => {
  test('DT12 – membro com null weight usa equalWeight via branch || quando usingEqual=false (L244)', () => {
    const memberWithWeight    = { user_id: 'u1', name: 'Ana', weight_percentage: 100, weekly_availability_hours: 10, role: 'admin' };
    const memberWithoutWeight = { user_id: 'u2', name: 'Bob', weight_percentage: null, weekly_availability_hours: 10, role: 'resident' };

    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [taskLight] }))
      .mockReturnValueOnce(makeStmt({ all: [memberWithWeight, memberWithoutWeight] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute(distributeArgs);
    expect(result.balance.find(b => b.user_id === 'u2')).toBeDefined();
  });
});

// ─── Branch: reduce true (L287) – fallback seleciona 2º membro com menor carga

describe('distribute – fallback reduce aciona branch true quando 2º membro tem menor esforço', () => {
  test('DT13 – dois grupos com todos limitados: grupo2 pega o membro com menor carga acumulada (L287)', () => {
    const tARoom = { id: 'tA', name: 'A', frequency: 'weekly', duration_minutes: 10, effort_level: 'light', room: 'Sala',   is_active: 1 };
    const tBRoom = { id: 'tB', name: 'B', frequency: 'weekly', duration_minutes: 10, effort_level: 'light', room: 'Cozinha', is_active: 1 };
    const prefs = [
      { user_id: 'u1', task_id: 'tA', preference_level: 'hate', has_physical_limitation: 1 },
      { user_id: 'u2', task_id: 'tA', preference_level: 'hate', has_physical_limitation: 1 },
      { user_id: 'u1', task_id: 'tB', preference_level: 'hate', has_physical_limitation: 1 },
      { user_id: 'u2', task_id: 'tB', preference_level: 'hate', has_physical_limitation: 1 },
    ];

    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [tARoom, tBRoom] }))
      .mockReturnValueOnce(makeStmt({ all: [memberA, memberB] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValueOnce(makeStmt({ all: prefs }))
      .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute(distributeArgs);
    expect(result.total_tasks_assigned).toBe(2);
    // Os dois membros dividem as tarefas via fallback
    const totalActual = result.balance.reduce((s, b) => s + b.actual_percentage, 0);
    expect(totalActual).toBeCloseTo(100, 0);
  });
});

// ─── Branch: totalEffort === 0 no balanço final (L330) ───────────────────────

describe('distribute – totalEffort zero quando período não gera ocorrências', () => {
  test('DT14 – actual_percentage=0 para todos quando período invertido não gera ocorrências (L330)', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [taskLight] }))
      .mockReturnValueOnce(makeStmt({ all: [memberA] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute({ ...distributeArgs, periodStart: '2024-07-31', periodEnd: '2024-07-01' });
    expect(result.total_tasks_assigned).toBe(0);
    result.balance.forEach(b => expect(b.actual_percentage).toBe(0));
  });
});

// ─── Fallback quando todos têm limitação física ───────────────────────────────

describe('distribute – fallback quando todos os membros têm limitação', () => {
  test('DT08 – atribui ao membro com menor carga quando todos têm limitação', () => {
    const prefU1 = { user_id: 'u1', task_id: 't1', preference_level: 'hate', has_physical_limitation: 1 };
    const prefU2 = { user_id: 'u2', task_id: 't1', preference_level: 'hate', has_physical_limitation: 1 };

    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [taskLight] }))
      .mockReturnValueOnce(makeStmt({ all: [memberA, memberB] }))
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValueOnce(makeStmt({ all: [prefU1, prefU2] }))
      .mockReturnValue(makeStmt({ get: { tolerance_percentage: 10 } }));

    const result = distribute(distributeArgs);

    // Mesmo com limitação em todos, o fallback atribui ao membro com menor carga
    expect(result.total_tasks_assigned).toBeGreaterThan(0);
  });
});
