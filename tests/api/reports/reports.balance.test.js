require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const {
  registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa, distribuirTarefas,
} = require('../helpers/auth.helper');
const fixture = require('../fixtures/reports/data');

describe('GET /api/houses/:houseId/reports/balance — Painel de Balanceamento (admin) — RN02', function () {
  this.timeout(15000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;

  before(async function () {
    limparBancoDados();

    const adminData = { name: 'Admin Balance', email: 'admin.balance@test.com', password: 'senha123' };
    const moradorData = { name: 'Morador Balance', email: 'morador.balance@test.com', password: 'senha123' };
    const moradorB = { name: 'Morador Balance B', email: 'morador.balanceb@test.com', password: 'senha123' };

    await registrarUsuario(adminData);
    await registrarUsuario(moradorData);
    await registrarUsuario(moradorB);

    tokenAdmin = await obterToken(adminData.email, adminData.password);
    tokenMorador = await obterToken(moradorData.email, moradorData.password);
    const tokenMoradorB = await obterToken(moradorB.email, moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Balance');
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);
    await entrarNaCasa(tokenMoradorB, casa.invite_code);

    await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa Balance', frequency: 'weekly', effort_level: 'light' });
    await distribuirTarefas(tokenAdmin, houseId, '2026-11-01', '2026-11-07');
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/balance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get(`/api/houses/${houseId}/reports/balance`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta acessar painel de balanceamento (RN06)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/balance`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar painel de balanceamento com campos obrigatórios (RN02)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/balance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    ['using_equal_distribution', 'tolerance_percentage', 'within_tolerance', 'members'].forEach(campo => {
      expect(resposta.body).to.have.property(campo);
    });
  });

  it('deve retornar members com campos de balanço por morador', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/balance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.members).to.be.an('array').with.length.above(0);
    resposta.body.members.forEach(membro => {
      ['user_id', 'name', 'target_percentage', 'actual_percentage', 'deviation', 'within_tolerance'].forEach(campo => {
        expect(membro).to.have.property(campo);
      });
    });
  });

  it('deve indicar using_equal_distribution true quando nenhum peso definido (RN02)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/balance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.using_equal_distribution).to.be.true;
  });

  it('tolerance_percentage deve ser um número positivo (RN02)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/balance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.tolerance_percentage).to.be.a('number').and.above(0);
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/balance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
