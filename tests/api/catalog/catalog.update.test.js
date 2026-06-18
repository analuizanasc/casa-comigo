require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa, atualizarPapel, obterMembros } = require('../helpers/auth.helper');
const fixture = require('../fixtures/catalog/update');

describe('PUT /api/houses/:houseId/catalog/:taskId — Atualizar Tarefa (EP02-US02/US03)', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenGestor;
  let tokenMorador;
  let houseId;
  let tarefaId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.gestor);
    await registrarUsuario(fixture.morador);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    const tokenGestorTemp = await obterToken(fixture.gestor.email, fixture.gestor.password);
    tokenMorador = await obterToken(fixture.morador.email, fixture.morador.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenGestorTemp, casa.invite_code);
    await entrarNaCasa(tokenMorador, casa.invite_code);

    const membros = await obterMembros(tokenAdmin, houseId);
    const gestorMembro = membros.find(m => m.email === fixture.gestor.email);
    if (gestorMembro) {
      await atualizarPapel(tokenAdmin, houseId, gestorMembro.user_id, 'catalog_manager');
    }

    tokenGestor = tokenGestorTemp;

    const tarefa = await criarTarefa(tokenAdmin, houseId, fixture.tarefaOriginal);
    tarefaId = tarefa.id;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método PUT', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(fixture.tarefaAtualizada);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .send(fixture.tarefaAtualizada);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta atualizar tarefa (RN06)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.tarefaAtualizada);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('gestor de catálogo deve poder atualizar tarefa (RN06)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send(fixture.tarefaAtualizada);

    expect(resposta.status).to.equal(200);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve atualizar tarefa com todos os campos e retornar dados atualizados', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(fixture.tarefaAtualizada);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.name).to.equal(fixture.tarefaAtualizada.name);
    expect(resposta.body.frequency).to.equal(fixture.tarefaAtualizada.frequency);
    expect(resposta.body.effort_level).to.equal(fixture.tarefaAtualizada.effort_level);
    expect(resposta.body.room).to.equal(fixture.tarefaAtualizada.room);
    expect(resposta.body.duration_minutes).to.equal(fixture.tarefaAtualizada.duration_minutes);
  });

  it('deve retornar dependências e dependentes na resposta', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(fixture.tarefaAtualizada);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('dependencies');
    expect(resposta.body).to.have.property('dependents');
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando nome está vazio', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: '', frequency: 'weekly', effort_level: 'light' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 com frequência inválida', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa', frequency: 'invalida', effort_level: 'light' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 com nível de esforço inválido', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa', frequency: 'weekly', effort_level: 'extremo' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 quando taskId não existe', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(fixture.tarefaAtualizada);

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(fixture.tarefaAtualizada);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
