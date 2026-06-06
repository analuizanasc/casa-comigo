require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/catalog.dependencies.fixture');

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

    // Morador entra na casa
    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorTemp}`)
      .send({ invite_code: casa.invite_code });

    tokenMorador = tokenMoradorTemp;

    // Cria três tarefas para testar dependências (A → B → C: espanar → varrer → passar pano)
    const tarefaACriada = await criarTarefa(tokenAdmin, houseId, fixture.tarefaA);
    const tarefaBCriada = await criarTarefa(tokenAdmin, houseId, fixture.tarefaB);
    const tarefaCCriada = await criarTarefa(tokenAdmin, houseId, fixture.tarefaC);

    tarefaAId = tarefaACriada.id;
    tarefaBId = tarefaBCriada.id;
    tarefaCId = tarefaCCriada.id;
  });

  // ─── VERB: Verifica que o método POST está correto ───────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    // Arrange — ID inexistente gera 404 (não 405), sem criar a dependência B→A prematuramente
    const corpo = { depends_on_task_id: '00000000-0000-0000-0000-000000000000' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert — qualquer status diferente de 405 confirma que o verbo POST é aceito
    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA: Dependência válida (RN01) ─────────────────────────────────────────

  it('deve adicionar dependência entre tarefas respeitando RN01 (tarefa B após tarefa A)', async function () {
    // Arrange — tarefa B (varrer) deve ser executada APÓS tarefa A (espanar)
    const corpo = { depends_on_task_id: tarefaAId };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('message');
  });

  it('deve adicionar dependência em cadeia: tarefa C após tarefa B (espanar → varrer → passar pano)', async function () {
    // Arrange — RN01: dependências formam sequência de execução
    const corpo = { depends_on_task_id: tarefaBId };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaCId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('message');
  });

  it('deve refletir a dependência ao consultar a tarefa dependente', async function () {
    // Arrange — cria par de tarefas próprio para garantir isolamento total
    const tRef1 = await criarTarefa(tokenAdmin, houseId, { name: 'Ref T1 Consulta', frequency: 'monthly', effort_level: 'light' });
    const tRef2 = await criarTarefa(tokenAdmin, houseId, { name: 'Ref T2 Consulta', frequency: 'monthly', effort_level: 'light' });
    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tRef2.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tRef1.id });

    // Act
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/catalog/${tRef2.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    // Assert
    expect(resposta.status).to.equal(200);
    expect(resposta.body.dependencies).to.be.an('array').with.length.above(0);
    const dep = resposta.body.dependencies.find(d => d.depends_on_task_id === tRef1.id);
    expect(dep).to.exist;
  });

  // ─── ERRORS: Casos inválidos ─────────────────────────────────────────────────

  fixture.casosInvalidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app)
        .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      if (caso.respostaEsperada.temErro) {
        expect(resposta.body).to.have.property('error');
      }
    });
  });

  it('deve retornar 400 quando tarefa tenta depender de si mesma (RN01 - dependência circular)', async function () {
    // Arrange — auto-dependência é proibida
    const corpo = { depends_on_task_id: tarefaAId };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaAId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 ao detectar dependência circular (viola RN01)', async function () {
    // Arrange — cria cadeia própria circ_B→circ_A, circ_C→circ_B; tenta circ_A→circ_C (ciclo)
    const tCircA = await criarTarefa(tokenAdmin, houseId, { name: 'Circ A', frequency: 'monthly', effort_level: 'light' });
    const tCircB = await criarTarefa(tokenAdmin, houseId, { name: 'Circ B', frequency: 'monthly', effort_level: 'light' });
    const tCircC = await criarTarefa(tokenAdmin, houseId, { name: 'Circ C', frequency: 'monthly', effort_level: 'light' });

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tCircB.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tCircA.id });

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tCircC.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tCircB.id });

    // Act — circ_A depender de circ_C criaria ciclo A→C→B→A
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tCircA.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tCircC.id });

    // Assert
    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 409 quando dependência já existe', async function () {
    // Arrange — cria par próprio e adiciona a dependência uma vez
    const tDup1 = await criarTarefa(tokenAdmin, houseId, { name: 'Dup T1', frequency: 'monthly', effort_level: 'light' });
    const tDup2 = await criarTarefa(tokenAdmin, houseId, { name: 'Dup T2', frequency: 'monthly', effort_level: 'light' });
    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tDup2.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tDup1.id });

    // Act — tenta adicionar a mesma dependência novamente
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tDup2.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tDup1.id });

    // Assert
    expect(resposta.status).to.equal(409);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION: Apenas admin e gestor ───────────────────────────────────

  it('deve retornar 403 quando morador (residente) tenta adicionar dependência', async function () {
    // Arrange
    const corpo = { depends_on_task_id: tarefaAId };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    // Arrange — sem Authorization
    const corpo = { depends_on_task_id: tarefaAId };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS: Formato de resposta ────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    // Arrange
    const corpo = { depends_on_task_id: tarefaAId };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaBId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
