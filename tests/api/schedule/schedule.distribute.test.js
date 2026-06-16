require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/schedule/distribute');

describe('POST /api/houses/:houseId/schedule/distribute — Distribuição de Tarefas (RN02/RN03)', function () {
  this.timeout(10000);

  let tokenAdmin;
  let tokenMoradorA;
  let houseId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.moradorA);
    await registrarUsuario(fixture.moradorB);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMoradorA = await obterToken(fixture.moradorA.email, fixture.moradorA.password);
    const tokenMoradorB = await obterToken(fixture.moradorB.email, fixture.moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Distribuição');
    houseId = casa.id;

    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorA}`)
      .send({ invite_code: casa.invite_code });

    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorB}`)
      .send({ invite_code: casa.invite_code });

    for (const tarefa of fixture.tarefas) {
      await criarTarefa(tokenAdmin, houseId, tarefa);
    }
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2025-07-01', period_end: '2025-07-07' });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve gerar distribuição automática para período de uma semana', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2025-08-01', period_end: '2025-08-07' });

    expect(resposta.status).to.equal(201);
    ['period_start', 'period_end', 'total_tasks_assigned', 'within_tolerance', 'balance'].forEach(campo => {
      expect(resposta.body).to.have.property(campo);
    });
    expect(resposta.body.total_tasks_assigned).to.be.a('number').above(0);
  });

  it('deve gerar distribuição com rótulo de período personalizado', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2025-12-01', period_end: '2025-12-31', period_label: 'dezembro-2025' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('period_start', '2025-12-01');
    expect(resposta.body).to.have.property('period_end', '2025-12-31');
  });

  it('deve retornar balanço de distribuição com dados de cada morador (RN02)', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2025-09-01', period_end: '2025-09-07' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.balance).to.be.an('array').with.length.above(0);

    resposta.body.balance.forEach(entrada => {
      expect(entrada).to.have.property('user_id');
      expect(entrada).to.have.property('name');
      expect(entrada).to.have.property('target_percentage');
      expect(entrada).to.have.property('actual_percentage');
      expect(entrada).to.have.property('deviation');
      expect(entrada).to.have.property('within_tolerance');
    });
  });

  it('deve respeitar distribuição igualitária quando nenhum peso for definido (RN02)', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2025-10-01', period_end: '2025-10-07' });

    expect(resposta.status).to.equal(201);
    const soma = resposta.body.balance.reduce((acc, e) => acc + e.target_percentage, 0);
    expect(soma).to.be.closeTo(100, 1);
  });

  it('deve incluir campo within_tolerance no resultado (RN02)', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2025-11-01', period_end: '2025-11-07' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('within_tolerance').that.is.a('boolean');
  });

  it('deve retornar 400 quando catálogo está vazio (sem tarefas ativas)', async function () {
    const adminVazio = { name: 'Admin Vazio', email: 'admin.vazio@test.com', password: 'senha123' };
    await registrarUsuario(adminVazio);
    const tokenAdminVazio = await obterToken(adminVazio.email, adminVazio.password);
    const casaVazia = await criarCasaComAdmin(tokenAdminVazio, 'Casa Sem Tarefas');

    const resposta = await request(app)
      .post(`/api/houses/${casaVazia.id}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdminVazio}`)
      .send({ period_start: '2025-07-01', period_end: '2025-07-07' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando period_start está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_end: '2025-07-31' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando period_end está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2025-07-01' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando period_start é posterior a period_end', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2025-07-31', period_end: '2025-07-01' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando corpo está vazio', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 403 quando morador residente tenta gerar distribuição', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenMoradorA}`)
      .send({ period_start: '2025-07-01', period_end: '2025-07-07' });

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .send({ period_start: '2025-07-01', period_end: '2025-07-07' });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2026-01-01', period_end: '2026-01-07' });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });

});
