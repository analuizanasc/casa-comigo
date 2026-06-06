/**
 * Helper para criar mocks do better-sqlite3.
 * Cada chamada a db.prepare() retorna um statement com get/all/run mockados.
 */

const makeStmt = (opts = {}) => ({
  get: jest.fn().mockReturnValue(opts.get !== undefined ? opts.get : null),
  all: jest.fn().mockReturnValue(opts.all !== undefined ? opts.all : []),
  run: jest.fn().mockReturnValue(opts.run !== undefined ? opts.run : { changes: 1 }),
});

module.exports = { makeStmt };
