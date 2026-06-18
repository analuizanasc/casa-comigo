require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const {
  registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa, distribuirTarefas,
} = require('../helpers/auth.helper');
const fixture = require('../fixtures/schedule/data');

describe('GET /api/houses/:houseId/schedule — Consultar Cronograma', function () {
  this.timeout(15000);

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

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenMoradorA, casa.invite_code);
    await entrarNaCasa(tokenMoradorB, casa.invite_code);

    for (const tarefa of fixture.tarefas) {
      await criarTarefa(tokenAdmin, houseId, tarefa);
    }

    await distribuirTarefas(tokenAdmin, houseId, fixture.periodoDistribuicao.period_start, fixture.periodoDistribuicao.period_end);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get(`/api/houses/${houseId}/schedule`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('admin deve ver todo o cronograma da casa', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').with.length.above(0);
  });

  it('deve retornar campos obrigatórios em cada atribuição', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    const atribuicao = resposta.body[0];
    ['id', 'task_id', 'task_name', 'assigned_to', 'assigned_to_name', 'scheduled_date', 'status'].forEach(campo => {
      expect(atribuicao).to.have.property(campo);
    });
  });

  it('morador (resident) deve ver apenas suas próprias tarefas (RN06)', async function () {
    const respostaAdmin = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const respostaMorador = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenMoradorA}`);

    expect(respostaMorador.status).to.equal(200);
    respostaMorador.body.forEach(atrib => {
      const adminEntry = respostaAdmin.body.find(a => a.id === atrib.id);
      expect(adminEntry).to.exist;
    });
    expect(respostaMorador.body.length).to.be.lte(respostaAdmin.body.length);
  });

  it('deve filtrar cronograma por date_from e date_to', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .query({
        date_from: fixture.periodoDistribuicao.period_start,
        date_to: fixture.periodoDistribuicao.period_end,
      });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array');
    resposta.body.forEach(a => {
      expect(a.scheduled_date >= fixture.periodoDistribuicao.period_start).to.be.true;
      expect(a.scheduled_date <= fixture.periodoDistribuicao.period_end).to.be.true;
    });
  });

  it('deve retornar lista vazia quando não há atribuições no período filtrado', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .query({ date_from: '2000-01-01', date_to: '2000-01-07' });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').that.is.empty;
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
