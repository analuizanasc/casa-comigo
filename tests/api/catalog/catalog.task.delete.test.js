require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/catalog/delete');

describe('DELETE /api/houses/:houseId/catalog/:taskId — Remover Tarefa (soft delete) (EP02-US02)', function () {
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

    const { obterMembros, atualizarPapel } = require('../helpers/auth.helper');
    const membros = await obterMembros(tokenAdmin, houseId);
    const gestorMembro = membros.find(m => m.email === fixture.gestor.email);
    if (gestorMembro) {
      await atualizarPapel(tokenAdmin, houseId, gestorMembro.user_id, 'catalog_manager');
    }

    tokenGestor = tokenGestorTemp;

    const tarefa = await criarTarefa(tokenAdmin, houseId, fixture.tarefa);
    tarefaId = tarefa.id;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método DELETE', async function () {
    const tarefa = await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa Verb Test', frequency: 'weekly', effort_level: 'light' });

    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefa.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefaId}`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta remover tarefa (RN06)', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('gestor de catálogo deve poder remover tarefa (RN06)', async function () {
    const tarefa = await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa Gestor Del', frequency: 'weekly', effort_level: 'light' });

    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefa.id}`)
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve remover (soft delete) a tarefa e retornar sucesso (EP02-US02)', async function () {
    const tarefa = await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa Para Deletar', frequency: 'daily', effort_level: 'medium' });

    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefa.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('tarefa removida não deve aparecer na listagem do catálogo', async function () {
    const tarefa = await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa Invisível', frequency: 'weekly', effort_level: 'light' });

    await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefa.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const lista = await request(app)
      .get(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const encontrada = lista.body.find(t => t.id === tarefa.id);
    expect(encontrada).to.be.undefined;
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 404 quando tarefa não existe', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 ao tentar remover tarefa já removida (soft delete idempotência)', async function () {
    const tarefa = await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa Duplo Del', frequency: 'weekly', effort_level: 'light' });

    await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefa.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefa.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(404);
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json em caso de erro', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
