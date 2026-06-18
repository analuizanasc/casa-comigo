require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/members/weight');

describe('PUT /api/houses/:houseId/members/:userId/weight — Peso de Distribuição (EP03-US04 / RN02 / RN07)', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;
  let moradorAId;
  let moradorBId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.moradorA);
    await registrarUsuario(fixture.moradorB);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.moradorA.email, fixture.moradorA.password);
    const tokenB = await obterToken(fixture.moradorB.email, fixture.moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);
    await entrarNaCasa(tokenB, casa.invite_code);

    moradorAId = obterIdUsuario(fixture.moradorA.email);
    moradorBId = obterIdUsuario(fixture.moradorB.email);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método PUT', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: fixture.pesoValido });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .send({ weight_percentage: fixture.pesoValido });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta definir peso (RN06)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ weight_percentage: fixture.pesoValido });

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve definir peso válido e retornar total_weight (RN02)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: fixture.pesoValido });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('total_weight');
    expect(resposta.body.total_weight).to.be.a('number');
  });

  it('deve retornar warning quando pesos não somam 100% (RN07)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: 40 });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('warning');
  });

  it('deve aceitar peso zero (membro sem carga)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: fixture.pesoZero });

    expect(resposta.status).to.equal(200);
  });

  it('deve aceitar peso máximo de 100', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: fixture.pesoMaximo });

    expect(resposta.status).to.equal(200);
  });

  it('não deve retornar warning quando pesos somam exatamente 100% (RN07)', async function () {
    await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: 60 });

    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorBId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: 40 });

    expect(resposta.status).to.equal(200);
    expect(resposta.body.warning).to.be.null;
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando peso é negativo', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: fixture.pesoNegativo });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando peso é acima de 100', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: fixture.pesoAcimaMaximo });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 ou 404 quando membro não existe', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/00000000-0000-0000-0000-000000000000/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: 50 });

    expect(resposta.status).to.be.oneOf([400, 404]);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorAId}/weight`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weight_percentage: 50 });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
