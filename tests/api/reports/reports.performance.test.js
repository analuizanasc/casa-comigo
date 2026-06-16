require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const {
  registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa, distribuirTarefas,
} = require('../helpers/auth.helper');
const fixture = require('../fixtures/reports/data');

describe('GET /api/houses/:houseId/reports/performance — Relatório de Desempenho (admin)', function () {
  this.timeout(15000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.moradorA);
    await registrarUsuario(fixture.moradorB);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.moradorA.email, fixture.moradorA.password);
    const tokenMoradorB = await obterToken(fixture.moradorB.email, fixture.moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);
    await entrarNaCasa(tokenMoradorB, casa.invite_code);

    for (const tarefa of fixture.tarefas) {
      await criarTarefa(tokenAdmin, houseId, tarefa);
    }

    await distribuirTarefas(tokenAdmin, houseId, fixture.periodoDistribuicao.period_start, fixture.periodoDistribuicao.period_end);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/performance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get(`/api/houses/${houseId}/reports/performance`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta acessar relatório de desempenho (RN06)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/performance`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar relatório de desempenho com campos obrigatórios', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/performance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('period');
    expect(resposta.body).to.have.property('members');
    expect(resposta.body.members).to.be.an('array');
  });

  it('deve retornar dados de desempenho de todos os membros', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/performance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.members).to.have.length.above(0);
    resposta.body.members.forEach(membro => {
      ['user_id', 'name', 'total_assigned', 'completed', 'overdue', 'redistributed', 'pending', 'completion_rate'].forEach(campo => {
        expect(membro).to.have.property(campo);
      });
    });
  });

  it('deve aceitar filtros de data date_from e date_to', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/performance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .query({
        date_from: fixture.periodoDistribuicao.period_start,
        date_to: fixture.periodoDistribuicao.period_end,
      });

    expect(resposta.status).to.equal(200);
    expect(resposta.body.period.from).to.equal(fixture.periodoDistribuicao.period_start);
    expect(resposta.body.period.to).to.equal(fixture.periodoDistribuicao.period_end);
  });

  it('deve retornar period.from e period.to nulos quando sem filtro de data', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/performance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.period.from).to.be.null;
    expect(resposta.body.period.to).to.be.null;
  });

  it('completion_rate deve ser um número entre 0 e 100', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/performance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    resposta.body.members.forEach(membro => {
      expect(membro.completion_rate).to.be.a('number').and.at.least(0).and.at.most(100);
    });
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/reports/performance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
