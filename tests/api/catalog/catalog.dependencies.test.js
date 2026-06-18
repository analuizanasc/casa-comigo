require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/catalog/dependencies');

describe('POST /api/houses/:houseId/catalog/:taskId/dependencies — Dependência entre Tarefas (RN01)', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;
  let tarefaAId;
  let tarefaBId;
  let tarefaCId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    const tokenMoradorTemp = await obterToken(fixture.morador.email, fixture.morador.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Dependências');
    houseId = casa.id;

    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorTemp}`)
      .send({ invite_code: casa.invite_code });

    tokenMorador = tokenMoradorTemp;

    const [tA, tB, tC] = await Promise.all([
      criarTarefa(tokenAdmin, houseId, fixture.tarefaA),
      criarTarefa(tokenAdmin, houseId, fixture.tarefaB),
      criarTarefa(tokenAdmin, houseId, fixture.tarefaC),
    ]);

    tarefaAId = tA.id;
    tarefaBId = tB.id;
    tarefaCId = tC.id;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: '00000000-0000-0000-0000-000000000000' });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve adicionar dependência entre tarefas respeitando RN01 (tarefa B após tarefa A)', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tarefaAId });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('message');
  });

  it('deve adicionar dependência em cadeia: C após B (espanar → varrer → passar pano)', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaCId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tarefaBId });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('message');
  });

  it('deve refletir a dependência ao consultar a tarefa dependente', async function () {
    const [tRef1, tRef2] = await Promise.all([
      criarTarefa(tokenAdmin, houseId, { name: 'Ref T1 Consulta', frequency: 'monthly', effort_level: 'light' }),
      criarTarefa(tokenAdmin, houseId, { name: 'Ref T2 Consulta', frequency: 'monthly', effort_level: 'light' }),
    ]);

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tRef2.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tRef1.id });

    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog/${tRef2.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.dependencies).to.be.an('array').with.length.above(0);
    expect(resposta.body.dependencies.find(d => d.depends_on_task_id === tRef1.id)).to.exist;
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando depends_on_task_id está ausente (RN01)', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando tarefa tenta depender de si mesma', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaAId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tarefaAId });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 ao detectar dependência circular (viola RN01)', async function () {
    const [tCircA, tCircB, tCircC] = await Promise.all([
      criarTarefa(tokenAdmin, houseId, { name: 'Circ A', frequency: 'monthly', effort_level: 'light' }),
      criarTarefa(tokenAdmin, houseId, { name: 'Circ B', frequency: 'monthly', effort_level: 'light' }),
      criarTarefa(tokenAdmin, houseId, { name: 'Circ C', frequency: 'monthly', effort_level: 'light' }),
    ]);

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tCircB.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tCircA.id });

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tCircC.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tCircB.id });

    // A→C criaria ciclo A→C→B→A
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tCircA.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tCircC.id });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 409 quando dependência já existe', async function () {
    const [tDup1, tDup2] = await Promise.all([
      criarTarefa(tokenAdmin, houseId, { name: 'Dup T1', frequency: 'monthly', effort_level: 'light' }),
      criarTarefa(tokenAdmin, houseId, { name: 'Dup T2', frequency: 'monthly', effort_level: 'light' }),
    ]);

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tDup2.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tDup1.id });

    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tDup2.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tDup1.id });

    expect(resposta.status).to.equal(409);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 403 quando morador (residente) tenta adicionar dependência', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ depends_on_task_id: tarefaAId });

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .send({ depends_on_task_id: tarefaAId });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tarefaAId });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
