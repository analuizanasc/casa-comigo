require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/schedule.distribute.fixture');

describe('POST /api/houses/:houseId/schedule/distribute — Distribuição de Tarefas (RN02/RN03)', function () {
  this.timeout(10000);

  let tokenAdmin;
  let tokenMoradorA;
  let tokenMoradorB;
  let houseId;
  let moradorAId;
  let moradorBId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.moradorA);
    await registrarUsuario(fixture.moradorB);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMoradorA = await obterToken(fixture.moradorA.email, fixture.moradorA.password);
    tokenMoradorB = await obterToken(fixture.moradorB.email, fixture.moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Distribuição');
    houseId = casa.id;

    // Moradores entram na casa
    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorA}`)
      .send({ invite_code: casa.invite_code });

    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorB}`)
      .send({ invite_code: casa.invite_code });

    // Cria tarefas no catálogo
    for (const tarefa of fixture.tarefas) {
      await criarTarefa(tokenAdmin, houseId, tarefa);
    }

    // Obtém IDs dos moradores
    const membros = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const membroA = membros.body.find(m => m.email === fixture.moradorA.email);
    const membroB = membros.body.find(m => m.email === fixture.moradorB.email);

    moradorAId = membroA ? membroA.user_id : null;
    moradorBId = membroB ? membroB.user_id : null;
  });

  // ─── VERB: Verifica que o método POST está correto ───────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    // Arrange
    const corpo = fixture.casosValidos[0].corpo;

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA: Distribuição válida ───────────────────────────────────────────────

  it('deve gerar distribuição automática para período de uma semana', async function () {
    // Arrange — usa primeiro caso do fixture (período já passado para evitar conflito)
    const corpo = {
      period_start: '2025-08-01',
      period_end: '2025-08-07',
    };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    fixture.casosValidos[0].respostaEsperada.camposObrigatorios.forEach(function (campo) {
      expect(resposta.body).to.have.property(campo);
    });
    expect(resposta.body.total_tasks_assigned).to.be.a('number').above(0);
  });

  it('deve retornar balanço de distribuição com dados de cada morador (RN02)', async function () {
    // Arrange
    const corpo = {
      period_start: '2025-09-01',
      period_end: '2025-09-07',
    };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body.balance).to.be.an('array').with.length.above(0);

    resposta.body.balance.forEach(function (entrada) {
      expect(entrada).to.have.property('user_id');
      expect(entrada).to.have.property('name');
      expect(entrada).to.have.property('target_percentage');
      expect(entrada).to.have.property('actual_percentage');
      expect(entrada).to.have.property('deviation');
      expect(entrada).to.have.property('within_tolerance');
    });
  });

  it('deve respeitar distribuição igualitária quando nenhum peso for definido (RN02)', async function () {
    // Arrange — sem pesos definidos, distribuição deve ser igualitária
    const corpo = {
      period_start: '2025-10-01',
      period_end: '2025-10-07',
    };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    const entradas = resposta.body.balance;
    const somaAlvo = entradas.reduce((soma, e) => soma + e.target_percentage, 0);
    expect(somaAlvo).to.be.closeTo(100, 1);
  });

  it('deve incluir campo within_tolerance no resultado (RN02)', async function () {
    // Arrange
    const corpo = {
      period_start: '2025-11-01',
      period_end: '2025-11-07',
    };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('within_tolerance').that.is.a('boolean');
  });

  it('deve gerar distribuição com rótulo de período personalizado', async function () {
    // Arrange
    const corpo = {
      period_start: '2025-12-01',
      period_end: '2025-12-31',
      period_label: 'dezembro-2025',
    };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('period_start', corpo.period_start);
    expect(resposta.body).to.have.property('period_end', corpo.period_end);
  });

  it('deve retornar 400 quando catálogo está vazio (sem tarefas ativas)', async function () {
    // Arrange — cria nova casa sem tarefas
    const adminSemTarefas = { name: 'Admin Vazio', email: 'admin.vazio@test.com', password: 'senha123' };
    await registrarUsuario(adminSemTarefas);
    const tokenAdminVazio = await obterToken(adminSemTarefas.email, adminSemTarefas.password);
    const casaVazia = await criarCasaComAdmin(tokenAdminVazio, 'Casa Sem Tarefas');

    const corpo = { period_start: '2025-07-01', period_end: '2025-07-07' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${casaVazia.id}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdminVazio}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  // ─── ERRORS: Dados inválidos ─────────────────────────────────────────────────

  fixture.casosInvalidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app)
        .post(`/api/houses/${houseId}/schedule/distribute`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      if (caso.respostaEsperada.temErro) {
        expect(resposta.body).to.have.property('error');
      }
    });
  });

  // ─── AUTHORIZATION: Apenas admin pode gerar distribuição ────────────────────

  it('deve retornar 403 quando morador residente tenta gerar distribuição', async function () {
    // Arrange
    const corpo = { period_start: '2025-07-01', period_end: '2025-07-07' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenMoradorA}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    // Arrange — sem Authorization
    const corpo = { period_start: '2025-07-01', period_end: '2025-07-07' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS: Formato de resposta ────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    // Arrange
    const corpo = { period_start: '2026-01-01', period_end: '2026-01-07' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });

  it('deve responder em menos de 5 segundos', async function () {
    // Arrange — distribuição pode ser mais demorada por ser operação complexa
    const corpo = { period_start: '2026-02-01', period_end: '2026-02-28' };
    const inicio = Date.now();

    // Act
    await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    const duracao = Date.now() - inicio;
    expect(duracao).to.be.below(5000);
  });
});
