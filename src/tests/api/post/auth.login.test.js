require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario } = require('../helpers/auth.helper');
const fixture = require('../fixtures/auth.login.fixture');

describe('POST /api/auth/login — Autenticação de Usuário', function () {
  this.timeout(5000);

  before(async function () {
    limparBancoDados();
    await registrarUsuario(fixture.usuarioPadrao);
  });

  // ─── VERB: Verifica que o método POST está correto ───────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    // Arrange
    const corpo = fixture.casosValidos[0].corpo;

    // Act
    const resposta = await request(app).post('/api/auth/login').send(corpo);

    // Assert
    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA: Caso de login válido ──────────────────────────────────────────────

  fixture.casosValidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app).post('/api/auth/login').send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      caso.respostaEsperada.camposObrigatorios.forEach(function (campo) {
        expect(resposta.body).to.have.property(campo);
      });
    });
  });

  it('deve retornar token JWT no formato correto (três partes separadas por ponto)', async function () {
    // Arrange
    const corpo = fixture.casosValidos[0].corpo;

    // Act
    const resposta = await request(app).post('/api/auth/login').send(corpo);

    // Assert
    expect(resposta.status).to.equal(200);
    const partes = resposta.body.token.split('.');
    expect(partes).to.have.lengthOf(3);
  });

  it('deve retornar os dados corretos do usuário no login', async function () {
    // Arrange
    const corpo = fixture.casosValidos[0].corpo;

    // Act
    const resposta = await request(app).post('/api/auth/login').send(corpo);

    // Assert
    expect(resposta.status).to.equal(200);
    expect(resposta.body.user).to.have.property('id');
    expect(resposta.body.user).to.have.property('name', fixture.usuarioPadrao.name);
    expect(resposta.body.user).to.have.property('email', fixture.usuarioPadrao.email);
    expect(resposta.body.user).to.not.have.property('password');
    expect(resposta.body.user).to.not.have.property('password_hash');
  });

  // ─── ERRORS: Campos obrigatórios e credenciais inválidas ────────────────────

  fixture.casosInvalidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app).post('/api/auth/login').send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      if (caso.respostaEsperada.temErro) {
        expect(resposta.body).to.have.property('error');
      }
    });
  });

  // ─── AUTHORIZATION: Endpoint público, não requer token ──────────────────────

  it('deve autenticar sem necessitar de token de autorização prévia', async function () {
    // Arrange — sem header Authorization
    const corpo = fixture.casosValidos[0].corpo;

    // Act
    const resposta = await request(app).post('/api/auth/login').send(corpo);

    // Assert — não é 401 nem 403
    expect(resposta.status).to.equal(200);
  });

  // ─── RESPONSIVENESS: Tempo de resposta e Content-Type ───────────────────────

  it('deve responder em menos de 3 segundos', async function () {
    // Arrange
    const corpo = fixture.casosValidos[0].corpo;
    const inicio = Date.now();

    // Act
    await request(app).post('/api/auth/login').send(corpo);

    // Assert
    const duracao = Date.now() - inicio;
    expect(duracao).to.be.below(3000);
  });

  it('deve retornar Content-Type application/json', async function () {
    // Arrange
    const corpo = fixture.casosValidos[0].corpo;

    // Act
    const resposta = await request(app).post('/api/auth/login').send(corpo);

    // Assert
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
