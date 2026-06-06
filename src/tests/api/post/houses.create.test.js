require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken } = require('../helpers/auth.helper');
const fixture = require('../fixtures/houses.create.fixture');

describe('POST /api/houses — Criação de Casa', function () {
  this.timeout(5000);

  let tokenAdmin;

  before(async function () {
    limparBancoDados();
    await registrarUsuario(fixture.usuarioPadrao);
    tokenAdmin = await obterToken(fixture.usuarioPadrao.email, fixture.usuarioPadrao.password);
  });

  // ─── VERB: Verifica que o método POST está correto ───────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    // Arrange
    const corpo = fixture.casosValidos[0].corpo;

    // Act
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA: Casos válidos ─────────────────────────────────────────────────────

  fixture.casosValidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app)
        .post('/api/houses')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      caso.respostaEsperada.camposObrigatorios.forEach(function (campo) {
        expect(resposta.body).to.have.property(campo);
      });
    });
  });

  it('deve retornar código de convite visível ao criador (admin)', async function () {
    // Arrange
    const corpo = { name: 'Casa do Código Visível' };

    // Act
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('invite_code');
    expect(resposta.body.invite_code).to.be.a('string').with.length.above(0);
  });

  it('deve criar casa com tolerância padrão de 10%', async function () {
    // Arrange
    const corpo = { name: 'Casa Tolerância Default' };

    // Act
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    expect(resposta.body.tolerance_percentage).to.equal(fixture.toleranciaDefault);
  });

  it('deve retornar ID único para cada casa criada', async function () {
    // Arrange
    const corpo1 = { name: 'Casa Unique A' };
    const corpo2 = { name: 'Casa Unique B' };

    // Act
    const resposta1 = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo1);
    const resposta2 = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo2);

    // Assert
    expect(resposta1.body.id).to.not.equal(resposta2.body.id);
  });

  // ─── ERRORS: Dados inválidos ─────────────────────────────────────────────────

  fixture.casosInvalidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app)
        .post('/api/houses')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      if (caso.respostaEsperada.temErro) {
        expect(resposta.body).to.have.property('error');
      }
    });
  });

  // ─── AUTHORIZATION: Token obrigatório ───────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    // Arrange — sem header Authorization

    // Act
    const resposta = await request(app)
      .post('/api/houses')
      .send({ name: 'Casa Sem Token' });

    // Assert
    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 com token inválido', async function () {
    // Arrange
    const tokenInvalido = 'Bearer token.invalido.aqui';

    // Act
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', tokenInvalido)
      .send({ name: 'Casa Token Inválido' });

    // Assert
    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS: Tempo e formato de resposta ────────────────────────────

  it('deve responder em menos de 3 segundos', async function () {
    // Arrange
    const corpo = { name: 'Casa Tempo Resposta' };
    const inicio = Date.now();

    // Act
    await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    const duracao = Date.now() - inicio;
    expect(duracao).to.be.below(3000);
  });

  it('deve retornar Content-Type application/json', async function () {
    // Arrange
    const corpo = { name: 'Casa Json Test' };

    // Act
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
