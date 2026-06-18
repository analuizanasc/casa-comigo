require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const {
  registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa, distribuirTarefas, obterCronograma,
} = require('../helpers/auth.helper');
const fixture = require('../fixtures/schedule/data');

describe('GET /api/houses/:houseId/schedule/:assignmentId — Detalhe de Atribuição', function () {
  this.timeout(15000);

  let tokenAdmin;
  let houseId;
  let atribuicaoId;

  before(async function () {
    limparBancoDados();

    const adminData = { name: 'Admin SchedDet', email: 'admin.scheddet@test.com', password: 'senha123' };
    const moradorData = { name: 'Morador SchedDet', email: 'morador.scheddet@test.com', password: 'senha123' };

    await registrarUsuario(adminData);
    await registrarUsuario(moradorData);

    tokenAdmin = await obterToken(adminData.email, adminData.password);
    const tokenMorador = await obterToken(moradorData.email, moradorData.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa SchedDet');
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);

    await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa SchedDet', frequency: 'weekly', effort_level: 'light' });

    await distribuirTarefas(tokenAdmin, houseId, '2026-10-01', '2026-10-07');

    const cronograma = await obterCronograma(tokenAdmin, houseId);
    atribuicaoId = cronograma[0].id;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule/${atribuicaoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule/${atribuicaoId}`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar detalhes completos da atribuição', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule/${atribuicaoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    ['id', 'task_id', 'task_name', 'assigned_to', 'assigned_to_name', 'scheduled_date', 'status'].forEach(campo => {
      expect(resposta.body).to.have.property(campo);
    });
  });

  it('deve retornar o ID correto da atribuição', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule/${atribuicaoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.id).to.equal(atribuicaoId);
  });

  it('deve retornar status pending para atribuição recém-criada', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule/${atribuicaoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.status).to.equal('pending');
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 404 quando atribuição não existe', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule/${atribuicaoId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
