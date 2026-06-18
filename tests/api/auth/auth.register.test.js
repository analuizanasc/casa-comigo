require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const fixture = require('../fixtures/auth/register');

describe('POST /api/auth/register — Cadastro de Usuário', function () {
  this.timeout(5000);

  before(function () {
    limparBancoDados();
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Verb Test', email: 'verb.register@test.com', password: 'senha123' });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve registrar usuário com todos os campos válidos', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send(fixture.usuarioValido);

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('message');
    expect(resposta.body).to.have.property('user');
  });

  it('deve registrar usuário com senha exatamente no limite mínimo (6 caracteres)', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send(fixture.usuarioLimiteMinimo);

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('message');
    expect(resposta.body).to.have.property('user');
  });

  it('deve retornar os dados do usuário criado sem expor a senha', async function () {
    const corpo = { name: 'Usuário Seguro', email: 'seguro@test.com', password: 'senha123' };

    const resposta = await request(app)
      .post('/api/auth/register')
      .send(corpo);

    expect(resposta.status).to.equal(201);
    expect(resposta.body.user).to.have.property('id');
    expect(resposta.body.user).to.have.property('name', corpo.name);
    expect(resposta.body.user).to.have.property('email', corpo.email);
    expect(resposta.body.user).to.not.have.property('password');
    expect(resposta.body.user).to.not.have.property('password_hash');
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando nome está ausente', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sem.nome@test.com', password: 'senha123' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando email está ausente', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sem Email', password: 'senha123' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando senha está ausente', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sem Senha', email: 'sem.senha@test.com' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando senha tem menos de 6 caracteres', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Senha Curta', email: 'senha.curta@test.com', password: '12345' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando corpo está completamente vazio', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 409 quando email já está cadastrado', async function () {
    await request(app).post('/api/auth/register').send(fixture.usuarioBase);

    const resposta = await request(app)
      .post('/api/auth/register')
      .send(fixture.usuarioBase);

    expect(resposta.status).to.equal(409);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve registrar usuário sem necessitar de token de autorização', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Público Teste', email: 'publico@test.com', password: 'senha123' });

    expect(resposta.status).to.equal(201);
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Json Test', email: 'json.test@test.com', password: 'senha123' });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
