require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/members/role');

describe('PUT /api/houses/:houseId/members/:userId/role — Atualizar Papel do Membro (RN06)', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;
  let moradorId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.morador.email, fixture.morador.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);
    moradorId = obterIdUsuario(fixture.morador.email);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método PUT', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: 'catalog_manager' });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .send({ role: 'catalog_manager' });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta alterar papel (RN06)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ role: 'admin' });

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve promover morador para catalog_manager (EP01-US04 / RN06)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: 'catalog_manager' });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('message');
  });

  it('deve revogar cargo de catalog_manager voltando para resident (EP01-US05)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: 'resident' });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('message');
  });

  it('deve promover morador para admin', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: 'admin' });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('message');

    await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: 'resident' });
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 com papel inválido', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: fixture.papelInvalido });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando body está vazio', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando admin tenta alterar seu próprio papel', async function () {
    const adminId = obterIdUsuario(fixture.admin.email);

    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${adminId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: 'resident' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 quando userId não é membro da casa', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/00000000-0000-0000-0000-000000000000/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: 'catalog_manager' });

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: 'resident' });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
