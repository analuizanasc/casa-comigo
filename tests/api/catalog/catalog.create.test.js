require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin } = require('../helpers/auth.helper');
const fixture = require('../fixtures/catalog/create');

describe('POST /api/houses/:houseId/catalog — Criação de Tarefa no Catálogo', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenGestor;
  let tokenMorador;
  let houseId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.gestorCatalogo);
    await registrarUsuario(fixture.morador);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    const tokenGestorTemp = await obterToken(fixture.gestorCatalogo.email, fixture.gestorCatalogo.password);
    const tokenMoradorTemp = await obterToken(fixture.morador.email, fixture.morador.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa do Catálogo');
    houseId = casa.id;

    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenGestorTemp}`)
      .send({ invite_code: casa.invite_code });

    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorTemp}`)
      .send({ invite_code: casa.invite_code });

    const membros = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const gestorMembro = membros.body.find(m => m.email === fixture.gestorCatalogo.email);
    if (gestorMembro) {
      await request(app)
        .put(`/api/houses/${houseId}/members/${gestorMembro.user_id}/role`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ role: 'catalog_manager' });
    }

    tokenGestor = tokenGestorTemp;
    tokenMorador = tokenMoradorTemp;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Verb Test', frequency: 'weekly', effort_level: 'light' });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA: campos e defaults ─────────────────────────────────────────────────

  it('deve criar tarefa com campos mínimos obrigatórios', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Varrer a sala', frequency: 'weekly', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    ['id', 'name', 'frequency', 'effort_level', 'is_active', 'dependencies', 'dependents'].forEach(campo => {
      expect(resposta.body).to.have.property(campo);
    });
  });

  it('deve criar tarefa com todos os campos preenchidos', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Lavar louça', description: 'Lavar toda a louça acumulada na pia', frequency: 'daily', duration_minutes: 20, effort_level: 'medium', room: 'Cozinha' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('room', 'Cozinha');
    expect(resposta.body).to.have.property('duration_minutes', 20);
  });

  it('deve criar tarefa com duração padrão de 30 minutos quando não informada', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa Duração Padrão', frequency: 'monthly', effort_level: 'medium' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.duration_minutes).to.equal(30);
  });

  it('deve criar tarefa como ativa (is_active = 1) com arrays vazios de dependências', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa Ativa Sem Dep', frequency: 'weekly', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.is_active).to.equal(1);
    expect(resposta.body.dependencies).to.be.an('array').that.is.empty;
    expect(resposta.body.dependents).to.be.an('array').that.is.empty;
  });

  it('gestor de catálogo deve criar tarefa com sucesso', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ name: 'Tarefa do Gestor', frequency: 'weekly', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('id');
  });

  // ─── DATA: frequências válidas ───────────────────────────────────────────────

  it('deve criar tarefa com frequência diária', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa daily', frequency: 'daily', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.frequency).to.equal('daily');
  });

  it('deve criar tarefa com frequência semanal', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa weekly', frequency: 'weekly', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.frequency).to.equal('weekly');
  });

  it('deve criar tarefa com frequência quinzenal', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa biweekly', frequency: 'biweekly', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.frequency).to.equal('biweekly');
  });

  it('deve criar tarefa com frequência mensal', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa monthly', frequency: 'monthly', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.frequency).to.equal('monthly');
  });

  it('deve criar tarefa com frequência trimestral', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa quarterly', frequency: 'quarterly', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.frequency).to.equal('quarterly');
  });

  it('deve criar tarefa com frequência anual', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa annual', frequency: 'annual', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.frequency).to.equal('annual');
  });

  // ─── DATA: níveis de esforço válidos ─────────────────────────────────────────

  it('deve criar tarefa com esforço leve', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa light', frequency: 'weekly', effort_level: 'light' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.effort_level).to.equal('light');
  });

  it('deve criar tarefa com esforço médio', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa medium', frequency: 'weekly', effort_level: 'medium' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.effort_level).to.equal('medium');
  });

  it('deve criar tarefa com esforço pesado', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa heavy', frequency: 'weekly', effort_level: 'heavy' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.effort_level).to.equal('heavy');
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando nome está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ frequency: 'weekly', effort_level: 'light' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando nome está vazio', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: '', frequency: 'weekly', effort_level: 'light' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando frequência está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa sem frequência', effort_level: 'light' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 com frequência inválida', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa freq inválida', frequency: 'invalida', effort_level: 'light' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando nível de esforço está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa sem esforço', frequency: 'weekly' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 com nível de esforço inválido', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa esforço inválido', frequency: 'weekly', effort_level: 'extremo' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 403 quando morador (residente) tenta criar tarefa', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.tarefaBase);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .send(fixture.tarefaBase);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...fixture.tarefaBase, name: 'Tarefa Json Type' });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
