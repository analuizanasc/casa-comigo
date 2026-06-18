require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');

describe('GET /api/health — Verificação de Saúde da API', function () {
  this.timeout(5000);

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app).get('/api/health');
    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve responder sem necessitar de token de autorização', async function () {
    const resposta = await request(app).get('/api/health');
    expect(resposta.status).to.equal(200);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar status ok', async function () {
    const resposta = await request(app).get('/api/health');

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('status', 'ok');
  });

  it('deve retornar campo timestamp no formato ISO 8601', async function () {
    const resposta = await request(app).get('/api/health');

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('timestamp');
    expect(new Date(resposta.body.timestamp).toISOString()).to.equal(resposta.body.timestamp);
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app).get('/api/health');
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
