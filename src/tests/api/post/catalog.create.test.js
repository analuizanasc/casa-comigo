require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin } = require('../helpers/auth.helper');
const fixture = require('../fixtures/catalog.create.fixture');

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

    // Gestor e morador entram na casa via convite
    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenGestorTemp}`)
      .send({ invite_code: casa.invite_code });

    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorTemp}`)
      .send({ invite_code: casa.invite_code });

    // Admin promove gestor de catálogo
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

  // ─── VERB: Verifica que o método POST está correto ───────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    // Arrange
    const corpo = fixture.casosValidos[0].corpo;

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA: Casos válidos (admin e gestor) ────────────────────────────────────

  fixture.casosValidos.forEach(function (caso) {
    it(`[admin] ${caso.descricao}`, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app)
        .post(`/api/houses/${houseId}/catalog`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      caso.respostaEsperada.camposObrigatorios.forEach(function (campo) {
        expect(resposta.body).to.have.property(campo);
      });
    });
  });

  it('gestor de catálogo deve criar tarefa com sucesso', async function () {
    // Arrange
    const corpo = { name: 'Tarefa do Gestor', frequency: 'weekly', effort_level: 'light' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('id');
    expect(resposta.body.name).to.equal(corpo.name);
  });

  it('deve criar tarefa com duração padrão de 30 minutos quando não informada', async function () {
    // Arrange — sem duration_minutes
    const corpo = { name: 'Tarefa Duração Padrão', frequency: 'monthly', effort_level: 'medium' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body.duration_minutes).to.equal(30);
  });

  it('deve criar tarefa e retornar arrays vazios de dependências e dependentes', async function () {
    // Arrange
    const corpo = { name: 'Tarefa Sem Dep', frequency: 'weekly', effort_level: 'light' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body.dependencies).to.be.an('array').that.is.empty;
    expect(resposta.body.dependents).to.be.an('array').that.is.empty;
  });

  it('deve criar tarefa como ativa (is_active = 1)', async function () {
    // Arrange
    const corpo = { name: 'Tarefa Ativa', frequency: 'weekly', effort_level: 'light' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body.is_active).to.equal(1);
  });

  // ─── DATA: Todas as frequências válidas (parametrizado) ─────────────────────

  fixture.frequenciasValidas.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = {
        name: `Tarefa ${caso.frequency}`,
        frequency: caso.frequency,
        effort_level: 'light',
      };

      // Act
      const resposta = await request(app)
        .post(`/api/houses/${houseId}/catalog`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(201);
      expect(resposta.body.frequency).to.equal(caso.frequency);
    });
  });

  // ─── DATA: Todos os níveis de esforço válidos (parametrizado) ───────────────

  fixture.esforcoValido.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = {
        name: `Tarefa ${caso.effort_level}`,
        frequency: 'weekly',
        effort_level: caso.effort_level,
      };

      // Act
      const resposta = await request(app)
        .post(`/api/houses/${houseId}/catalog`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(201);
      expect(resposta.body.effort_level).to.equal(caso.effort_level);
    });
  });

  // ─── ERRORS: Dados inválidos ─────────────────────────────────────────────────

  fixture.casosInvalidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app)
        .post(`/api/houses/${houseId}/catalog`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      if (caso.respostaEsperada.temErro) {
        expect(resposta.body).to.have.property('error');
      }
    });
  });

  // ─── AUTHORIZATION: Apenas admin e gestor podem criar tarefas ───────────────

  it('deve retornar 403 quando morador (residente) tenta criar tarefa', async function () {
    // Arrange
    const corpo = fixture.tarefaBase;

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    // Arrange — sem Authorization
    const corpo = fixture.tarefaBase;

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS: Formato de resposta ────────────────────────────────────

  it('deve responder em menos de 3 segundos', async function () {
    // Arrange
    const corpo = fixture.tarefaBase;
    const inicio = Date.now();

    // Act
    await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...corpo, name: 'Tarefa Tempo Resposta' });

    // Assert
    const duracao = Date.now() - inicio;
    expect(duracao).to.be.below(3000);
  });

  it('deve retornar Content-Type application/json', async function () {
    // Arrange
    const corpo = { ...fixture.tarefaBase, name: 'Tarefa Json Type' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
