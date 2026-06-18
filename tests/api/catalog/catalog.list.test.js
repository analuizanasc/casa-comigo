require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/catalog/list');

describe('GET /api/houses/:houseId/catalog — Listar Tarefas do Catálogo', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let tokenForaDaCasa;
  let houseId;

  before(async function () {
    limparBancoDados();

    const foraData = { name: 'Fora Catalog', email: 'fora.catalog@test.com', password: 'senha123' };

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);
    await registrarUsuario(foraData);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.morador.email, fixture.morador.password);
    tokenForaDaCasa = await obterToken(foraData.email, foraData.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);

    for (const tarefa of fixture.tarefas) {
      await criarTarefa(tokenAdmin, houseId, tarefa);
    }
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get(`/api/houses/${houseId}/catalog`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando usuário não é membro da casa (RNF05)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenForaDaCasa}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('morador deve poder listar o catálogo (RN06)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(200);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar todas as tarefas ativas do catálogo', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').with.lengthOf(fixture.tarefas.length);
  });

  it('deve retornar campos obrigatórios para cada tarefa', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    const tarefa = resposta.body[0];
    ['id', 'name', 'frequency', 'effort_level', 'is_active', 'created_by', 'created_by_name'].forEach(campo => {
      expect(tarefa).to.have.property(campo);
    });
  });

  it('deve retornar apenas tarefas com is_active = 1', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    resposta.body.forEach(tarefa => {
      expect(tarefa.is_active).to.equal(1);
    });
  });

  it('deve retornar lista vazia quando catálogo está vazio', async function () {
    const adminVazio = { name: 'Admin Vazio Cat', email: 'admin.vazioc@test.com', password: 'senha123' };
    await registrarUsuario(adminVazio);
    const tokenVazio = await obterToken(adminVazio.email, adminVazio.password);
    const casaVazia = await criarCasaComAdmin(tokenVazio, 'Casa Catálogo Vazio');

    const resposta = await request(app)
      .get(`/api/houses/${casaVazia.id}/catalog`)
      .set('Authorization', `Bearer ${tokenVazio}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').that.is.empty;
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
