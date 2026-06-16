require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/houses/detail');

describe('GET /api/houses/:houseId — Obter Detalhes da Casa', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let tokenForaDaCasa;
  let casaCriada;

  before(async function () {
    limparBancoDados();

    const foraData = { name: 'Fora da Casa', email: 'fora.casa@test.com', password: 'senha123' };

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);
    await registrarUsuario(foraData);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.morador.email, fixture.morador.password);
    tokenForaDaCasa = await obterToken(foraData.email, foraData.password);

    casaCriada = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    await entrarNaCasa(tokenMorador, casaCriada.invite_code);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${casaCriada.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get(`/api/houses/${casaCriada.id}`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando usuário não é membro da casa (RNF05)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${casaCriada.id}`)
      .set('Authorization', `Bearer ${tokenForaDaCasa}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar detalhes da casa para o admin com invite_code visível', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${casaCriada.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('id', casaCriada.id);
    expect(resposta.body).to.have.property('name', fixture.nomeCasa);
    expect(resposta.body).to.have.property('invite_code');
    expect(resposta.body).to.have.property('tolerance_percentage');
  });

  it('morador deve ver detalhes da casa sem invite_code', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${casaCriada.id}`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('id', casaCriada.id);
    expect(resposta.body.invite_code).to.be.undefined;
  });

  it('deve retornar tolerance_percentage padrão de 10', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${casaCriada.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body.tolerance_percentage).to.equal(10);
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 403 com houseId inexistente (usuário não é membro)', async function () {
    const resposta = await request(app)
      .get('/api/houses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.be.oneOf([403, 404]);
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${casaCriada.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
