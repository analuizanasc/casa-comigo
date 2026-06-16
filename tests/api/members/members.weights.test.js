require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/members/weights');

describe('GET /api/houses/:houseId/members/weights — Painel de Pesos (RN02)', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.moradorA);
    await registrarUsuario(fixture.moradorB);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.moradorA.email, fixture.moradorA.password);
    const tokenMoradorB = await obterToken(fixture.moradorB.email, fixture.moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);
    await entrarNaCasa(tokenMoradorB, casa.invite_code);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members/weights`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get(`/api/houses/${houseId}/members/weights`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta acessar o painel (RN06)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members/weights`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar painel de pesos com campos obrigatórios', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members/weights`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    ['using_equal_distribution', 'total_defined_weight', 'is_valid', 'members'].forEach(campo => {
      expect(resposta.body).to.have.property(campo);
    });
  });

  it('deve indicar distribuição igualitária quando nenhum peso foi definido (RN02)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members/weights`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.using_equal_distribution).to.be.true;
  });

  it('deve retornar array de membros com effective_weight calculado', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members/weights`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.members).to.be.an('array').with.length.above(0);
    resposta.body.members.forEach(m => {
      expect(m).to.have.property('user_id');
      expect(m).to.have.property('name');
      expect(m).to.have.property('effective_weight');
    });
  });

  it('deve retornar is_valid true quando nenhum peso está definido (igual a 100% igualitário)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members/weights`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.is_valid).to.be.true;
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members/weights`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
