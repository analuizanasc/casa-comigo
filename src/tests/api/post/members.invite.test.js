require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin } = require('../helpers/auth.helper');
const fixture = require('../fixtures/members.invite.fixture');

describe('POST /api/houses/:houseId/members/invite — Convidar Membro', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);
    await registrarUsuario(fixture.novoUsuario);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    const tokenMoradorTemp = await obterToken(fixture.morador.email, fixture.morador.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa dos Membros');
    houseId = casa.id;

    // Adiciona morador como membro (residente) via join
    const casaDetalhes = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Outra Casa' });

    // Usa o código de convite para o morador entrar na casa principal
    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorTemp}`)
      .send({ invite_code: casa.invite_code });

    tokenMorador = tokenMoradorTemp;
  });

  // ─── VERB: Verifica que o método POST está correto ───────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    // Arrange — email inexistente gera 404 (não 405), sem consumir novoUsuario
    const corpo = { email: 'verb.invite.test@inexistente.com' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert — qualquer status diferente de 405 confirma que o verbo POST é aceito
    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA: Convite válido ────────────────────────────────────────────────────

  it('deve convidar usuário cadastrado como membro residente', async function () {
    // Arrange — novo usuário já registrado no sistema mas não é membro da casa
    const corpo = { email: fixture.novoUsuario.email };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(201);
    fixture.respostaEsperada.camposObrigatorios.forEach(function (campo) {
      expect(resposta.body).to.have.property(campo);
    });
    expect(resposta.body.role).to.equal(fixture.respostaEsperada.papelPadrao);
    expect(resposta.body.email).to.equal(fixture.novoUsuario.email);
  });

  // ─── ERRORS: Dados inválidos ─────────────────────────────────────────────────

  fixture.casosInvalidos.forEach(function (caso) {
    it(caso.descricao, async function () {
      // Arrange
      const corpo = caso.corpo;

      // Act
      const resposta = await request(app)
        .post(`/api/houses/${houseId}/members/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(corpo);

      // Assert
      expect(resposta.status).to.equal(caso.statusEsperado);
      if (caso.respostaEsperada.temErro) {
        expect(resposta.body).to.have.property('error');
      }
    });
  });

  it('deve retornar 409 quando usuário já é membro da casa', async function () {
    // Arrange — morador já foi adicionado no before()
    const corpo = { email: fixture.morador.email };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(409);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION: Apenas admin pode convidar ──────────────────────────────

  it('deve retornar 403 quando morador (residente) tenta convidar membro', async function () {
    // Arrange — morador é residente, não admin
    const corpo = { email: 'qualquer@test.com' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    // Arrange — sem Authorization
    const corpo = { email: fixture.novoUsuario.email };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .send(corpo);

    // Assert
    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS: Formato de resposta ────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    // Arrange
    const corpo = { email: 'json.members@test.com' };

    // Act
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(corpo);

    // Assert
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
