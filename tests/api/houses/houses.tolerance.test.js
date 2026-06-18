require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/houses/tolerance');

describe('PATCH /api/houses/:houseId/tolerance — Tolerância de Balanceamento (admin) — RN02', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.morador.email, fixture.morador.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método PATCH', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: fixture.toleranciaValida });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .send({ tolerance_percentage: fixture.toleranciaValida });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta alterar tolerância (RN06)', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ tolerance_percentage: fixture.toleranciaValida });

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve atualizar tolerância com valor válido (RN02)', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: fixture.toleranciaValida });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('message');
  });

  it('deve aceitar tolerância mínima de 1%', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: fixture.toleranciaMinima });

    expect(resposta.status).to.equal(200);
  });

  it('deve aceitar tolerância máxima de 50%', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: fixture.toleranciaMaxima });

    expect(resposta.status).to.equal(200);
  });

  it('deve refletir nova tolerância nos detalhes da casa', async function () {
    const novaTolerancias = 20;

    await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: novaTolerancias });

    const detalhes = await request(app)
      .get(`/api/houses/${houseId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(detalhes.body.tolerance_percentage).to.equal(novaTolerancias);
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando tolerância é 0 (abaixo do mínimo)', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: fixture.toleranciaAbaixoMinimo });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando tolerância é 51 (acima do máximo)', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: fixture.toleranciaAcimaMaximo });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando tolerance_percentage está ausente', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: fixture.toleranciaValida });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
