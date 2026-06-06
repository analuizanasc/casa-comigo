require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../app');
const { limparBancoDados } = require('../helpers/db.helper');
const fixture = require('../fixtures/auth.register.fixture');

describe('POST /api/auth/register — Cadastro de Usuário', function () {
  this.timeout(5000);

  before(function () {
    limparBancoDados();
  });

  // ─── VERB: Verifica que o método POST está correto ───────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    // Arrange — usa email exclusivo para não conflitar com os demais casos
    const corpo = { name: 'Verb Test', email: 'verb.register@test.com', password: 'senha123' };

    // Act
    const resposta = await request(app).post('/api/auth/register').send(corpo);

    // Assert
    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA: Casos válidos ─────────────────────────────────────────────────────

  fixture.casosValidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange — corpo vem do fixture
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app).post('/api/auth/register').send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      caso.respostaEsperada.camposObrigatorios.forEach(function (campo) {
        expect(resposta.body).to.have.property(campo);
      });
    });
  });

  it('deve retornar os dados do usuário criado sem expor a senha', async function () {
    // Arrange
    const corpo = { name: 'Usuário Seguro', email: 'seguro@test.com', password: 'senha123' };

    // Act
    const resposta = await request(app).post('/api/auth/register').send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body.user).to.have.property('id');
    expect(resposta.body.user).to.have.property('name', corpo.name);
    expect(resposta.body.user).to.have.property('email', corpo.email);
    expect(resposta.body.user).to.not.have.property('password');
    expect(resposta.body.user).to.not.have.property('password_hash');
  });

  // ─── ERRORS: Campos obrigatórios ausentes ───────────────────────────────────

  fixture.casosInvalidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange — corpo vem do fixture
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app).post('/api/auth/register').send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      if (caso.respostaEsperada.temErro) {
        expect(resposta.body).to.have.property('error');
      }
    });
  });

  // ─── ERRORS: Email duplicado (409) ──────────────────────────────────────────

  it('deve retornar 409 quando email já está cadastrado', async function () {
    // Arrange — primeiro cadastro
    const corpo = fixture.usuarioBase;
    await request(app).post('/api/auth/register').send(corpo);

    // Act — segundo cadastro com mesmo email
    const resposta = await request(app).post('/api/auth/register').send(corpo);

    // Assert
    expect(resposta.status).to.equal(409);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION: Endpoint público, não requer token ──────────────────────

  it('deve registrar usuário sem necessitar de token de autorização', async function () {
    // Arrange — sem header Authorization
    const corpo = { name: 'Público Teste', email: 'publico@test.com', password: 'senha123' };

    // Act
    const resposta = await request(app).post('/api/auth/register').send(corpo);

    // Assert — não é 401 nem 403
    expect(resposta.status).to.equal(201);
  });

  // ─── RESPONSIVENESS: Estrutura e tempo de resposta ──────────────────────────

  it('deve responder em menos de 3 segundos', async function () {
    // Arrange
    const corpo = { name: 'Tempo Resp', email: 'tempo.resp@test.com', password: 'senha123' };
    const inicio = Date.now();

    // Act
    await request(app).post('/api/auth/register').send(corpo);

    // Assert
    const duracao = Date.now() - inicio;
    expect(duracao).to.be.below(3000);
  });

  it('deve retornar Content-Type application/json', async function () {
    // Arrange
    const corpo = { name: 'Json Test', email: 'json.test@test.com', password: 'senha123' };

    // Act
    const resposta = await request(app).post('/api/auth/register').send(corpo);

    // Assert
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
