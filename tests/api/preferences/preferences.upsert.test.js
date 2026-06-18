require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/preferences/data');

describe('PUT /api/houses/:houseId/preferences/:taskId — Definir Preferência (EP03-US01/US02 / RN03)', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;
  let tarefaId;

  before(async function () {
    limparBancoDados();

    const adminData = { name: 'Admin PrefUps', email: 'admin.prefups@test.com', password: 'senha123' };
    const moradorData = { name: 'Morador PrefUps', email: 'morador.prefups@test.com', password: 'senha123' };

    await registrarUsuario(adminData);
    await registrarUsuario(moradorData);

    tokenAdmin = await obterToken(adminData.email, adminData.password);
    tokenMorador = await obterToken(moradorData.email, moradorData.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Pref Upsert');
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);

    const tarefa = await criarTarefa(tokenAdmin, houseId, fixture.tarefa);
    tarefaId = tarefa.id;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método PUT', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.preferenciaValida);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .send(fixture.preferenciaValida);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve registrar preferência "like" para tarefa (EP03-US01)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.preferenciaValida);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('task_id', tarefaId);
    expect(resposta.body).to.have.property('preference_level', fixture.preferenciaValida.preference_level);
    expect(resposta.body).to.have.property('has_physical_limitation', fixture.preferenciaValida.has_physical_limitation);
  });

  it('deve registrar preferência "hate" para tarefa', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.preferenciaOdio);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.preference_level).to.equal('hate');
  });

  it('deve registrar limitação física (RN03 — tarefa não será atribuída automaticamente)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.preferenciaLimitacao);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.has_physical_limitation).to.equal(true);
  });

  it('deve atualizar preferência já registrada (upsert)', async function () {
    await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ preference_level: 'hate', has_physical_limitation: false });

    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ preference_level: 'like', has_physical_limitation: false });

    expect(resposta.status).to.equal(200);
    expect(resposta.body.preference_level).to.equal('like');
  });

  it('admin também pode registrar suas próprias preferências', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(fixture.preferenciaValida);

    expect(resposta.status).to.equal(200);
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 com preference_level inválido', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.preferenciaInvalida);

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando preference_level está ausente', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 quando taskId não existe', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.preferenciaValida);

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.preferenciaValida);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
