const { v4: uuidv4 } = require('uuid');

jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('../../src/config/database', () => ({
  prepare: jest.fn(),
  transaction: jest.fn(fn => (...args) => fn(...args)),
}));

const db = require('../../src/config/database');
const { makeStmt } = require('../helpers/db-mock');
const {
  getMyPreferences,
  getMemberPreferences,
  upsertPreference,
} = require('../../src/services/preferences.service');

// ─── getMyPreferences ─────────────────────────────────────────────────────────

describe('getMyPreferences', () => {
  test('PR01 – retorna preferências mescladas com padrão neutral', () => {
    const tasks = [
      { id: 't1', name: 'Varrer', room: 'Sala', effort_level: 'light' },
      { id: 't2', name: 'Lavar', room: 'Cozinha', effort_level: 'heavy' },
    ];
    const prefs = [{ task_id: 't1', preference_level: 'like', has_physical_limitation: 0 }];

    db.prepare
      .mockReturnValueOnce(makeStmt({ all: tasks }))
      .mockReturnValueOnce(makeStmt({ all: prefs }));

    const result = getMyPreferences('h1', 'u1');

    expect(result).toHaveLength(2);
    const t1 = result.find(p => p.task_id === 't1');
    const t2 = result.find(p => p.task_id === 't2');
    expect(t1.preference_level).toBe('like');
    expect(t2.preference_level).toBe('neutral'); // padrão
  });

  test('PR02 – retorna lista vazia se não há tarefas', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ all: [] }))
      .mockReturnValueOnce(makeStmt({ all: [] }));

    const result = getMyPreferences('h1', 'u1');
    expect(result).toHaveLength(0);
  });
});

// ─── getMemberPreferences ─────────────────────────────────────────────────────

describe('getMemberPreferences', () => {
  test('PR03 – retorna preferências brutas do membro', () => {
    const prefs = [{ task_id: 't1', preference_level: 'hate', has_physical_limitation: 1 }];
    db.prepare.mockReturnValueOnce(makeStmt({ all: prefs }));

    const result = getMemberPreferences('h1', 'u2');
    expect(result).toHaveLength(1);
    expect(result[0].preference_level).toBe('hate');
  });
});

// ─── upsertPreference ─────────────────────────────────────────────────────────

describe('upsertPreference', () => {
  const validArgs = {
    houseId: 'h1', userId: 'u1', taskId: 't1',
    preferenceLevel: 'like', hasPhysicalLimitation: false,
  };

  test('PR04 – cria nova preferência quando não existe', () => {
    uuidv4.mockReturnValue('pref-id');
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } }))  // task exists
      .mockReturnValueOnce(makeStmt({ get: null }))           // preference não existe
      .mockReturnValueOnce(makeStmt());                       // INSERT

    const result = upsertPreference(validArgs);

    expect(result.preference_level).toBe('like');
    expect(result.has_physical_limitation).toBe(false);
  });

  test('PR05 – atualiza preferência quando já existe', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } }))       // task exists
      .mockReturnValueOnce(makeStmt({ get: { id: 'pref-id' } }))  // preference existe
      .mockReturnValueOnce(makeStmt());                            // UPDATE

    const result = upsertPreference({ ...validArgs, preferenceLevel: 'hate' });
    expect(result.preference_level).toBe('hate');
  });

  test('PR06 – salva has_physical_limitation como true corretamente', () => {
    uuidv4.mockReturnValue('pref-id');
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } }))
      .mockReturnValueOnce(makeStmt({ get: null }))
      .mockReturnValueOnce(makeStmt());

    const result = upsertPreference({ ...validArgs, hasPhysicalLimitation: true });
    expect(result.has_physical_limitation).toBe(true);
  });

  test('PR05b – UPDATE com hasPhysicalLimitation=true cobre branch true do ternário (linha UPDATE)', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 't1' } }))
      .mockReturnValueOnce(makeStmt({ get: { id: 'pref-id' } }))
      .mockReturnValueOnce(makeStmt());

    const result = upsertPreference({ ...validArgs, preferenceLevel: 'hate', hasPhysicalLimitation: true });
    expect(result.has_physical_limitation).toBe(true);
  });

  test('PR07 – lança 400 para preference_level inválido', () => {
    let err;
    try { upsertPreference({ ...validArgs, preferenceLevel: 'meh' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Preferência inválida/);
  });

  test('PR08 – lança 404 se tarefa não existe', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { upsertPreference(validArgs); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });
});
