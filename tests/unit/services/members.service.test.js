const { v4: uuidv4 } = require('uuid');

jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('../../../src/config/database', () => ({
  prepare: jest.fn(),
  transaction: jest.fn(fn => (...args) => fn(...args)),
}));

const db = require('../../../src/config/database');
const { makeStmt } = require('../helpers/db-mock');
const {
  getMembers,
  inviteMember,
  updateRole,
  updateWeight,
  updateAvailability,
  removeMember,
  getWeightsSummary,
} = require('../../../src/services/members.service');

const fakeMember = { id: 'm1', user_id: 'u2', name: 'Bob', email: 'bob@test.com', role: 'resident', weight_percentage: null, weekly_availability_hours: 10, created_at: '2024' };

// ─── getMembers ───────────────────────────────────────────────────────────────

describe('getMembers', () => {
  test('MS01 – retorna lista de membros', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ all: [fakeMember] }));

    const result = getMembers('h1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bob');
  });
});

// ─── inviteMember ─────────────────────────────────────────────────────────────

describe('inviteMember', () => {
  test('MS02 – convida usuário existente com sucesso', () => {
    uuidv4.mockReturnValue('new-member-id');
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'u2', name: 'Bob', email: 'bob@test.com' } })) // find user
      .mockReturnValueOnce(makeStmt({ get: null }))                          // não é membro ainda
      .mockReturnValueOnce(makeStmt({ get: null }))                          // sem convite pendente
      .mockReturnValueOnce(makeStmt({ get: { name: 'Ana' } }))              // nome do inviter
      .mockReturnValueOnce(makeStmt({ get: { name: 'Casa Legal' } }))       // nome da casa
      .mockReturnValueOnce(makeStmt())                                       // INSERT invitation
      .mockReturnValueOnce(makeStmt());                                      // INSERT notification

    const result = inviteMember({ houseId: 'h1', email: 'bob@test.com', invitedBy: 'u1' });

    expect(result.status).toBe('pending');
    expect(result.invited_user.name).toBe('Bob');
  });

  test('MS03 – lança 404 se e-mail não está cadastrado', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { inviteMember({ houseId: 'h1', email: 'ninguem@test.com', invitedBy: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });

  test('MS04 – lança 409 se usuário já é membro', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'u2', name: 'Bob', email: 'bob@test.com' } }))
      .mockReturnValueOnce(makeStmt({ get: { id: 'existing-member' } }));

    let err;
    try { inviteMember({ houseId: 'h1', email: 'bob@test.com', invitedBy: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(409);
  });
});

// ─── updateRole ───────────────────────────────────────────────────────────────

describe('updateRole', () => {
  test('MS05 – atualiza papel com sucesso', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'm1' } }))           // find member
      .mockReturnValueOnce(makeStmt())                                 // UPDATE role
      .mockReturnValueOnce(makeStmt({ get: { name: 'Casa Legal' } })) // nome da casa (notificação)
      .mockReturnValueOnce(makeStmt());                                // INSERT notification

    expect(() => updateRole({ houseId: 'h1', targetUserId: 'u2', role: 'catalog_manager', requesterId: 'u1' })).not.toThrow();
  });

  test('MS06 – lança 400 ao tentar alterar próprio papel', () => {
    let err;
    try { updateRole({ houseId: 'h1', targetUserId: 'u1', role: 'resident', requesterId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/próprio/);
  });

  test('MS07 – lança 400 para papel inválido', () => {
    let err;
    try { updateRole({ houseId: 'h1', targetUserId: 'u2', role: 'superuser', requesterId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Papel inválido/);
  });

  test('MS08 – lança 404 se membro não pertence à casa', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { updateRole({ houseId: 'h1', targetUserId: 'u2', role: 'resident', requesterId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });
});

// ─── updateWeight ─────────────────────────────────────────────────────────────

describe('updateWeight', () => {
  test('MS09 – atualiza peso e retorna warning quando soma ≠ 100', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'm1' } }))  // find member
      .mockReturnValueOnce(makeStmt())                       // UPDATE
      .mockReturnValueOnce(makeStmt({ get: { total: 40 } })); // SUM weights

    const result = updateWeight({ houseId: 'h1', targetUserId: 'u2', weightPercentage: 40 });

    expect(result.total_weight).toBe(40);
    expect(result.warning).not.toBeNull();
  });

  test('MS10 – sem warning quando pesos somam 100', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'm1' } }))
      .mockReturnValueOnce(makeStmt())
      .mockReturnValueOnce(makeStmt({ get: { total: 100 } }));

    const result = updateWeight({ houseId: 'h1', targetUserId: 'u2', weightPercentage: 100 });

    expect(result.warning).toBeNull();
  });

  test('MS11 – lança 400 para peso negativo', () => {
    let err;
    try { updateWeight({ houseId: 'h1', targetUserId: 'u2', weightPercentage: -1 }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
  });

  test('MS12 – lança 400 para peso > 100', () => {
    let err;
    try { updateWeight({ houseId: 'h1', targetUserId: 'u2', weightPercentage: 101 }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
  });

  test('MS09b – total_weight é 0 quando SUM retorna null (branch ||)', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'm1' } }))
      .mockReturnValueOnce(makeStmt())
      .mockReturnValueOnce(makeStmt({ get: { total: null } }));

    const result = updateWeight({ houseId: 'h1', targetUserId: 'u2', weightPercentage: 50 });
    expect(result.total_weight).toBe(0);
    expect(result.warning).not.toBeNull();
  });

  test('MS13 – lança 404 se membro não existe', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { updateWeight({ houseId: 'h1', targetUserId: 'u99', weightPercentage: 50 }); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });
});

// ─── updateAvailability ───────────────────────────────────────────────────────

describe('updateAvailability', () => {
  test('MS14 – atualiza disponibilidade com sucesso', () => {
    db.prepare.mockReturnValueOnce(makeStmt());

    expect(() => updateAvailability({ houseId: 'h1', targetUserId: 'u1', weeklyAvailabilityHours: 12 })).not.toThrow();
  });

  test('MS15 – lança 400 para disponibilidade negativa', () => {
    let err;
    try { updateAvailability({ houseId: 'h1', targetUserId: 'u1', weeklyAvailabilityHours: -5 }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
  });
});

// ─── removeMember ─────────────────────────────────────────────────────────────

describe('removeMember', () => {
  test('MS16 – remove membro com sucesso', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'm2', role: 'resident' } }))
      .mockReturnValueOnce(makeStmt());

    expect(() => removeMember({ houseId: 'h1', targetUserId: 'u2', requesterId: 'u1' })).not.toThrow();
  });

  test('MS17 – lança 400 ao tentar remover a si mesmo', () => {
    let err;
    try { removeMember({ houseId: 'h1', targetUserId: 'u1', requesterId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/si mesmo/);
  });

  test('MS18 – lança 404 se membro não existe na casa', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));

    let err;
    try { removeMember({ houseId: 'h1', targetUserId: 'u99', requesterId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(404);
  });

  test('MS19 – lança 400 ao tentar remover o único admin', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'm1', role: 'admin' } }))
      .mockReturnValueOnce(makeStmt({ get: { count: 1 } })); // apenas 1 admin

    let err;
    try { removeMember({ houseId: 'h1', targetUserId: 'u2', requesterId: 'u1' }); }
    catch (e) { err = e; }

    expect(err.status).toBe(400);
    expect(err.message).toMatch(/único administrador/);
  });

  test('MS20 – permite remover admin quando há outro admin', () => {
    db.prepare
      .mockReturnValueOnce(makeStmt({ get: { id: 'm1', role: 'admin' } }))
      .mockReturnValueOnce(makeStmt({ get: { count: 2 } })) // 2 admins
      .mockReturnValueOnce(makeStmt());                     // DELETE

    expect(() => removeMember({ houseId: 'h1', targetUserId: 'u2', requesterId: 'u1' })).not.toThrow();
  });
});

// ─── getWeightsSummary ────────────────────────────────────────────────────────

describe('getWeightsSummary', () => {
  test('MS21 – com pesos definidos calcula total e retorna is_valid=true quando soma 100', () => {
    const members = [
      { user_id: 'u1', name: 'Ana', weight_percentage: 60, role: 'admin' },
      { user_id: 'u2', name: 'Bob', weight_percentage: 40, role: 'resident' },
    ];
    db.prepare.mockReturnValueOnce(makeStmt({ all: members }));

    const result = getWeightsSummary('h1');

    expect(result.total_defined_weight).toBe(100);
    expect(result.is_valid).toBe(true);
    expect(result.using_equal_distribution).toBe(false);
  });

  test('MS22 – sem pesos usa distribuição igualitária', () => {
    const members = [
      { user_id: 'u1', name: 'Ana', weight_percentage: null, role: 'admin' },
      { user_id: 'u2', name: 'Bob', weight_percentage: null, role: 'resident' },
    ];
    db.prepare.mockReturnValueOnce(makeStmt({ all: members }));

    const result = getWeightsSummary('h1');

    expect(result.using_equal_distribution).toBe(true);
    expect(result.members[0].effective_weight).toBe(50);
  });
});
