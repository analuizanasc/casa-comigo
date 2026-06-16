require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/houses/me');

describe('GET /api/houses/me — Listar Casas do Usuário', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let casaCriada;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.morador.email, fixture.morador.password);

    casaCriada = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);

    await entrarNaCasa(tokenMorador, casaCriada.invite_code);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get('/api/houses/me')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get('/api/houses/me');

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 com token inválido', async function () {
    const resposta = await request(app)
      .get('/api/houses/me')
      .set('Authorization', 'Bearer token.invalido.aqui');

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar lista de casas do usuário autenticado', async function () {
    const resposta = await request(app)
      .get('/api/houses/me')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').with.length.above(0);
  });

  it('deve retornar campos obrigatórios para cada casa', async function () {
    const resposta = await request(app)
      .get('/api/houses/me')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    const casa = resposta.body[0];
    ['id', 'name', 'role', 'created_at'].forEach(campo => {
      expect(casa).to.have.property(campo);
    });
  });

  it('deve retornar role do usuário em cada casa', async function () {
    const resposta = await request(app)
      .get('/api/houses/me')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    const casa = resposta.body.find(c => c.id === casaCriada.id);
    expect(casa).to.exist;
    expect(casa.role).to.equal('admin');
  });

  it('morador deve ver a casa com role resident', async function () {
    const resposta = await request(app)
      .get('/api/houses/me')
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(200);
    const casa = resposta.body.find(c => c.id === casaCriada.id);
    expect(casa).to.exist;
    expect(casa.role).to.equal('resident');
  });

  it('deve retornar lista vazia quando usuário não é membro de nenhuma casa', async function () {
    const semCasa = { name: 'Usuário Sem Casa', email: 'sem.casa@test.com', password: 'senha123' };
    await registrarUsuario(semCasa);
    const tokenSemCasa = await obterToken(semCasa.email, semCasa.password);

    const resposta = await request(app)
      .get('/api/houses/me')
      .set('Authorization', `Bearer ${tokenSemCasa}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').that.is.empty;
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get('/api/houses/me')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
