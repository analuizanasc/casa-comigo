jest.mock('../../src/config/database', () => ({
  prepare: jest.fn(),
  transaction: jest.fn(fn => (...args) => fn(...args)),
}));

const db = require('../../src/config/database');
const { makeStmt } = require('../helpers/db-mock');
const { getPerformanceReport, getBalancePanel } = require('../../src/services/reports.service');

const fakeMembers = [
  { user_id: 'u1', name: 'Ana', role: 'admin',     weight_percentage: 60 },
  { user_id: 'u2', name: 'Bob', role: 'resident',  weight_percentage: 40 },
];

// ─── getPerformanceReport ─────────────────────────────────────────────────────

describe('getPerformanceReport', () => {
  test('RP01 – retorna relatório com taxas de conclusão por membro', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ all: fakeMembers }))
      // Estatísticas u1
      .mockReturnValueOnce(makeStmt({ get: { total: 10, completed: 8, overdue: 1, redistributed: 0, pending: 1 } }))
      // Estatísticas u2
      .mockReturnValueOnce(makeStmt({ get: { total: 5, completed: 5, overdue: 0, redistributed: 0, pending: 0 } }));

    const result = getPerformanceReport('h1', {});

    expect(result.members).toHaveLength(2);
    const ana = result.members.find(m => m.user_id === 'u1');
    expect(ana.completion_rate).toBe(80);
    expect(ana.overdue).toBe(1);
    const bob = result.members.find(m => m.user_id === 'u2');
    expect(bob.completion_rate).toBe(100);
  });

  test('RP02 – completion_rate é 0 quando membro não tem tarefas', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [fakeMembers[0]] }))
      .mockReturnValueOnce(makeStmt({ get: { total: 0, completed: 0, overdue: 0, redistributed: 0, pending: 0 } }));

    const result = getPerformanceReport('h1', {});

    expect(result.members[0].completion_rate).toBe(0);
  });

  test('RP03 – aplica filtros de data quando fornecidos', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [fakeMembers[0]] }))
      .mockReturnValueOnce(makeStmt({ get: { total: 3, completed: 2, overdue: 0, redistributed: 1, pending: 0 } }));

    const result = getPerformanceReport('h1', { dateFrom: '2024-07-01', dateTo: '2024-07-31' });

    expect(result.period.from).toBe('2024-07-01');
    expect(result.period.to).toBe('2024-07-31');
    expect(result.members[0].redistributed).toBe(1);
  });
});

// ─── getBalancePanel ──────────────────────────────────────────────────────────

describe('getBalancePanel', () => {
  test('RP04 – retorna balanço com desvio e within_tolerance corretos', () => {
    const assignments = [
      { assigned_to: 'u1', effort_level: 'heavy' },  // peso 3
      { assigned_to: 'u1', effort_level: 'light' },  // peso 1
      { assigned_to: 'u2', effort_level: 'medium' }, // peso 2
    ];

    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { tolerance_percentage: 10 } }))
      .mockReturnValueOnce(makeStmt({ all: fakeMembers }))
      .mockReturnValueOnce(makeStmt({ all: assignments }));

    const result = getBalancePanel('h1');

    expect(result.tolerance_percentage).toBe(10);
    expect(result.members).toHaveLength(2);
    const ana = result.members.find(m => m.user_id === 'u1');
    // u1 tem 4/6 ≈ 66.7% actual vs 60% target → desvio +6.7 < 10 → within_tolerance = true
    expect(ana.target_percentage).toBe(60);
    expect(ana.within_tolerance).toBe(true);
  });

  test('RP05 – usa distribuição igualitária quando nenhum membro tem peso definido', () => {
    const membersNoPeso = [
      { user_id: 'u1', name: 'Ana', weight_percentage: null, role: 'admin' },
      { user_id: 'u2', name: 'Bob', weight_percentage: null, role: 'resident' },
    ];

    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { tolerance_percentage: 10 } }))
      .mockReturnValueOnce(makeStmt({ all: membersNoPeso }))
      .mockReturnValueOnce(makeStmt({ all: [] }));

    const result = getBalancePanel('h1');

    expect(result.using_equal_distribution).toBe(true);
    result.members.forEach(m => {
      expect(m.target_percentage).toBe(50);
    });
  });

  test('RP04b – ignora atribuições de membros removidos (branch effortByMember !== undefined)', () => {
    const assignments = [
      { assigned_to: 'u-ghost', effort_level: 'heavy' },  // membro não existe mais na casa
      { assigned_to: 'u1', effort_level: 'light' },
    ];

    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { tolerance_percentage: 10 } }))
      .mockReturnValueOnce(makeStmt({ all: [fakeMembers[0]] }))
      .mockReturnValueOnce(makeStmt({ all: assignments }));

    const result = getBalancePanel('h1');
    expect(result.members).toHaveLength(1);
    expect(result.members[0].actual_percentage).toBeGreaterThan(0);
  });

  test('RP05b – membro com peso null usa equalWeight via branch || quando usingEqual=false (L84)', () => {
    const memberComPeso   = { user_id: 'u1', name: 'Ana', weight_percentage: 100, role: 'admin' };
    const memberSemPeso   = { user_id: 'u2', name: 'Bob', weight_percentage: null, role: 'resident' };

    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { tolerance_percentage: 10 } }))
      .mockReturnValueOnce(makeStmt({ all: [memberComPeso, memberSemPeso] }))
      .mockReturnValueOnce(makeStmt({ all: [] }));

    const result = getBalancePanel('h1');
    // u1 tem peso=100 → usingEqual=false. u2 tem peso=null → null||equalWeight → equalWeight=50
    expect(result.using_equal_distribution).toBe(false);
    const u2 = result.members.find(m => m.user_id === 'u2');
    expect(u2.target_percentage).toBe(50);
  });

  test('RP06 – actual_percentage é 0 quando não há atribuições', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { tolerance_percentage: 10 } }))
      .mockReturnValueOnce(makeStmt({ all: [fakeMembers[0]] }))
      .mockReturnValueOnce(makeStmt({ all: [] }));

    const result = getBalancePanel('h1');

    expect(result.members[0].actual_percentage).toBe(0);
  });
});
