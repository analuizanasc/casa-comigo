const { v4: uuidv4 } = require('uuid');

jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('../../src/config/database', () => ({
  prepare: jest.fn(),
  transaction: jest.fn(fn => (...args) => fn(...args)),
}));

const db = require('../../src/config/database');
const { makeStmt } = require('../helpers/db-mock');
const {
  createHouse,
  getHouseById,
  getMyHouses,
  joinByInviteCode,
  updateTolerance,
} = require('../../src/services/houses.service');

const fakeHouseRow = { id: 'h1', name: 'Casa 42', invite_code: 'XYZ999', tolerance_percentage: 10, created_at: '2024-01-01' };

// ─── createHouse ─────────────────────────────────────────────────────────────

describe('createHouse', () => {
  test('HS01 – cria casa, adiciona criador como admin e retorna casa com invite_code', () => {
    uuidv4.mockReturnValueOnce('h1').mockReturnValueOnce('m1');

    db.prepare
      .mockReturnValueOnce(makeStmt({ get: null }))       // invite code único
      .mockReturnValueOnce(makeStmt())                    // INSERT houses
      .mockReturnValueOnce(makeStmt())                    // INSERT house_members
      .mockReturnValueOnce(makeStmt({ get: fakeHouseRow }))  // getHouseById: SELECT house
      .mockReturnValueOnce(makeStmt({ get: { role: 'admin' } })); // getHouseById: SELECT member role

    const result = createHouse({ name: 'Casa 42', userId: 'u1' });

    expect(result.id).toBe('h1');
    expect(result.name).toBe('Casa 42');
    expect(result.invite_code).toBe('XYZ999');
  });

  test('HS02 – tenta novo código quando há colisão de invite_code', () => {
    uuidv4.mockReturnValueOnce('h1').mockReturnValueOnce('m1');

    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'other' } })) // colisão
      .mockReturnValueOnce(makeStmt({ get: null }))             // segundo código OK
      .mockReturnValueOnce(makeStmt())                          // INSERT houses
      .mockReturnValueOnce(makeStmt())                          // INSERT house_members
      .mockReturnValueOnce(makeStmt({ get: fakeHouseRow }))
      .mockReturnValueOnce(makeStmt({ get: { role: 'admin' } }));

    const result = createHouse({ name: 'Casa 42', userId: 'u1' });
    expect(result).toBeDefined();
  });
});

// ─── getHouseById ─────────────────────────────────────────────────────────────

describe('getHouseById', () => {
  test('HS03 – admin recebe invite_code no retorno', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeHouseRow }))
      .mockReturnValueOnce(makeStmt({ get: { role: 'admin' } }));

    const result = getHouseById('h1', 'u1');

    expect(result.invite_code).toBe('XYZ999');
  });

  test('HS04 – morador não recebe invite_code', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeHouseRow }))
      .mockReturnValueOnce(makeStmt({ get: { role: 'resident' } }));

    const result = getHouseById('h1', 'u2');

    expect(result.invite_code).toBeUndefined();
  });

  test('HS05 – retorna null quando casa não existe', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    const result = getHouseById('inexistente', 'u1');

    expect(result).toBeNull();
  });
});

// ─── getMyHouses ─────────────────────────────────────────────────────────────

describe('getMyHouses', () => {
  test('HS06 – retorna lista de casas do usuário', () => {
    const houses = [{ id: 'h1', name: 'Casa 42', role: 'admin', created_at: '2024' }];
    db.prepare.mockReturnValueOnce(makeStmt({ all: houses }));

    const result = getMyHouses('u1');

    expect(result).toEqual(houses);
  });

  test('HS07 – retorna array vazio se usuário não tem casas', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ all: [] }));

    const result = getMyHouses('u1');

    expect(result).toHaveLength(0);
  });
});

// ─── joinByInviteCode ─────────────────────────────────────────────────────────

describe('joinByInviteCode', () => {
  test('HS08 – entra na casa com código válido', () => {
    uuidv4.mockReturnValue('new-member-id');

    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeHouseRow }))   // find house
      .mockReturnValueOnce(makeStmt({ get: null }))           // not already member
      .mockReturnValueOnce(makeStmt())                        // INSERT house_members
      .mockReturnValueOnce(makeStmt({ get: fakeHouseRow }))  // getHouseById
      .mockReturnValueOnce(makeStmt({ get: { role: 'resident' } }));

    const result = joinByInviteCode({ inviteCode: 'XYZ999', userId: 'u2' });

    expect(result).toBeDefined();
  });

  test('HS09 – lança 404 para código de convite inválido', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { joinByInviteCode({ inviteCode: 'INVALIDO', userId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
    expect(err.message).toMatch(/inválido/);
  });

  test('HS10 – lança 409 se usuário já é membro', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: fakeHouseRow }))
      .mockReturnValueOnce(makeStmt({ get: { id: 'existing-member' } }));

    let err;
    try { joinByInviteCode({ inviteCode: 'XYZ999', userId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(409);
  });
});

// ─── updateTolerance ─────────────────────────────────────────────────────────

describe('updateTolerance', () => {
  test('HS11 – atualiza tolerância com valor válido', () => {
    db.prepare.mockReturnValueOnce(makeStmt());

    expect(() => updateTolerance('h1', 15)).not.toThrow();
    expect(db.prepare).toHaveBeenCalledTimes(1);
  });

  test('HS12 – lança 400 se tolerância < 1', () => {
    let err;
    try { updateTolerance('h1', 0); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  test('HS13 – lança 400 se tolerância > 50', () => {
    let err;
    try { updateTolerance('h1', 51); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
  });
});
