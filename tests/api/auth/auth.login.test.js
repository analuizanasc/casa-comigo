require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario } = require('../helpers/auth.helper');
const fixture = require('../fixtures/auth/login');

describe('POST /api/auth/login — Autenticação de Usuário', function () {
  this.timeout(5000);

  before(async function () {
    limparBancoDados();
    await registrarUsuario(fixture.usuarioPadrao);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.usuarioPadrao.email, password: fixture.usuarioPadrao.password });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve autenticar com credenciais válidas e retornar token JWT', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.usuarioPadrao.email, password: fixture.usuarioPadrao.password });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('token');
    expect(resposta.body).to.have.property('user');
  });

  it('deve retornar token JWT no formato correto (três partes separadas por ponto)', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.usuarioPadrao.email, password: fixture.usuarioPadrao.password });

    expect(resposta.status).to.equal(200);
    expect(resposta.body.token.split('.')).to.have.lengthOf(3);
  });

  it('deve retornar os dados corretos do usuário sem expor a senha', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.usuarioPadrao.email, password: fixture.usuarioPadrao.password });

    expect(resposta.status).to.equal(200);
    expect(resposta.body.user).to.have.property('id');
    expect(resposta.body.user).to.have.property('name', fixture.usuarioPadrao.name);
    expect(resposta.body.user).to.have.property('email', fixture.usuarioPadrao.email);
    expect(resposta.body.user).to.not.have.property('password');
    expect(resposta.body.user).to.not.have.property('password_hash');
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando email está ausente', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ password: 'senha123' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando senha está ausente', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.usuarioPadrao.email });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando corpo está completamente vazio', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 com senha incorreta', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.usuarioPadrao.email, password: 'senhaErrada' });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 com email não cadastrado', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nao.existe@test.com', password: 'senha123' });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve autenticar sem necessitar de token de autorização prévia', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.usuarioPadrao.email, password: fixture.usuarioPadrao.password });

    expect(resposta.status).to.equal(200);
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: fixture.usuarioPadrao.email, password: fixture.usuarioPadrao.password });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
