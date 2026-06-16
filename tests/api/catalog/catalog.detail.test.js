require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/catalog/detail');

describe('GET /api/houses/:houseId/catalog/:taskId — Obter Tarefa com Dependências', function () {
  this.timeout(5000);

  let tokenAdmin;
  let houseId;
  let tarefaId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    const tarefa = await criarTarefa(tokenAdmin, houseId, fixture.tarefa);
    tarefaId = tarefa.id;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get(`/api/houses/${houseId}/catalog/${tarefaId}`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar detalhes da tarefa com campos obrigatórios', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    ['id', 'name', 'frequency', 'effort_level', 'is_active', 'dependencies', 'dependents'].forEach(campo => {
      expect(resposta.body).to.have.property(campo);
    });
  });

  it('deve retornar o nome correto da tarefa', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.name).to.equal(fixture.tarefa.name);
  });

  it('deve retornar arrays de dependências e dependentes vazios inicialmente', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.dependencies).to.be.an('array').that.is.empty;
    expect(resposta.body.dependents).to.be.an('array').that.is.empty;
  });

  it('deve retornar dependências quando existem (RN01)', async function () {
    const tarefaPrevia = await criarTarefa(tokenAdmin, houseId, {
      name: 'Tarefa Prévia (Detail)',
      frequency: 'weekly',
      effort_level: 'light',
    });

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tarefaPrevia.id });

    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.dependencies).to.be.an('array').with.length.above(0);
    expect(resposta.body.dependencies[0]).to.have.property('depends_on_task_id', tarefaPrevia.id);
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 404 quando taskId não existe', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
