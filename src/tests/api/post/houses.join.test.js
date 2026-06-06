require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin } = require('../helpers/auth.helper');
const fixture = require('../fixtures/houses.join.fixture');

describe('POST /api/houses/join — Entrar em Casa via Código de Convite', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenNovoMembro;
  let casaCriada;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.novoMembro);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenNovoMembro = await obterToken(fixture.novoMembro.email, fixture.novoMembro.password);

    casaCriada = await criarCasaComAdmin(tokenAdmin, 'Casa do Convite');
  });

  // ─── VERB: Verifica que o método POST está correto ───────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    // Arrange — código inexistente garante 404 (não 405), sem consumir o convite do novoMembro
    const corpo = { invite_code: 'VERB999' };

    // Act
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send(corpo);

    // Assert — qualquer status diferente de 405 confirma que o verbo POST é aceito
    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA: Entrada válida com código correto ─────────────────────────────────

  it('deve entrar na casa com código de convite válido e retornar dados da casa', async function () {
    // Arrange — o membro ainda não entrou (somente o admin criou a casa)
    const corpo = { invite_code: casaCriada.invite_code };

    // Act
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(200);
    fixture.respostaEsperada.camposObrigatorios.forEach(function (campo) {
      expect(resposta.body).to.have.property(campo);
    });
    expect(resposta.body.id).to.equal(casaCriada.id);
  });

  // ─── ERRORS: Casos de erro ───────────────────────────────────────────────────

  fixture.casosInvalidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app)
        .post('/api/houses/join')
        .set('Authorization', `Bearer ${tokenNovoMembro}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      if (caso.respostaEsperada.temErro) {
        expect(resposta.body).to.have.property('error');
      }
    });
  });

  it('deve retornar 409 quando usuário já é membro da casa', async function () {
    // Arrange — garante que novoMembro é membro (idempotente: entra se ainda não for,
    // recebe 409 se já for — em ambos os casos o membro estará na casa ao final do Arrange)
    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({ invite_code: casaCriada.invite_code });

    // Act — tenta entrar novamente, independente do que ocorreu acima
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({ invite_code: casaCriada.invite_code });

    // Assert
    expect(resposta.status).to.equal(409);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION: Token obrigatório ───────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    // Arrange — sem Authorization header
    const corpo = { invite_code: casaCriada.invite_code };

    // Act
    const resposta = await request(app)
      .post('/api/houses/join')
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS: Tempo e formato ────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    // Arrange
    const corpo = { invite_code: 'QUALQUER' };

    // Act
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send(corpo);

    // Assert
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
