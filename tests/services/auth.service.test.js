const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('../../src/config/database', () => ({
  prepare: jest.fn(),
  transaction: jest.fn(fn => (...args) => fn(...args)),
}));

const db = require('../../src/config/database');
const { makeStmt } = require('../helpers/db-mock');
const { register, login } = require('../../src/services/auth.service');

// ─── register ────────────────────────────────────────────────────────────────

describe('register', () => {
  test('CS01 – cria usuário e retorna id, name, email', () => {
    uuidv4.mockReturnValue('uuid-123');
    bcrypt.hashSync.mockReturnValue('hash_abc');

    db.prepare
      .mockReturnValueOnce(makeStmt({ get: null }))   // e-mail inexistente
      .mockReturnValueOnce(makeStmt());               // INSERT users

    const result = register({ name: 'Ana', email: 'ana@test.com', password: 'senha123' });

    expect(result).toEqual({ id: 'uuid-123', name: 'Ana', email: 'ana@test.com' });
    expect(bcrypt.hashSync).toHaveBeenCalledWith('senha123', 10);
    expect(db.prepare).toHaveBeenCalledTimes(2);
  });

  test('CS02 – lança erro 409 quando e-mail já está cadastrado', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: { id: 'existing-id' } }));

    let err;
    try { register({ name: 'X', email: 'dup@test.com', password: '123' }); }
    catch (e) { err = e; }

    expect(err.message).toBe('E-mail já cadastrado.');
    expect(err.status).toBe(409);
    // Não deve chamar INSERT
    expect(db.prepare).toHaveBeenCalledTimes(1);
  });
});

// ─── login ───────────────────────────────────────────────────────────────────

describe('login', () => {
  const fakeUser = { id: 'u1', email: 'ana@test.com', name: 'Ana', password_hash: 'hash' };

  test('CS03 – retorna token e dados do usuário com credenciais válidas', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: fakeUser }));
    bcrypt.compareSync.mockReturnValue(true);
    jwt.sign.mockReturnValue('jwt.token.here');

    const result = login({ email: 'ana@test.com', password: 'senha123' });

    expect(result.token).toBe('jwt.token.here');
    expect(result.user).toEqual({ id: 'u1', name: 'Ana', email: 'ana@test.com' });
    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: 'u1', email: 'ana@test.com', name: 'Ana' },
      process.env.JWT_SECRET,
      expect.any(Object)
    );
  });

  test('CS04 – lança erro 401 quando usuário não existe', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: null }));
    bcrypt.compareSync.mockReturnValue(false);

    let err;
    try { login({ email: 'nao@existe.com', password: '123' }); }
    catch (e) { err = e; }

    expect(err.message).toBe('Credenciais inválidas.');
    expect(err.status).toBe(401);
  });

  test('CS05 – lança erro 401 quando senha está errada', () => {
    db.prepare.mockReturnValueOnce(makeStmt({ get: fakeUser }));
    bcrypt.compareSync.mockReturnValue(false);

    let err;
    try { login({ email: 'ana@test.com', password: 'errada' }); }
    catch (e) { err = e; }

    expect(err.message).toBe('Credenciais inválidas.');
    expect(err.status).toBe(401);
  });
});
