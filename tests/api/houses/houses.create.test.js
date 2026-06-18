require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken } = require('../helpers/auth.helper');
const fixture = require('../fixtures/houses/create');

describe('POST /api/houses — Criação de Casa', function () {
  this.timeout(5000);

  let tokenAdmin;

  before(async function () {
    limparBancoDados();
    await registrarUsuario(fixture.usuarioPadrao);
    tokenAdmin = await obterToken(fixture.usuarioPadrao.email, fixture.usuarioPadrao.password);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Casa Verb Test' });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve criar casa com nome válido e retornar campos obrigatórios', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Apartamento 42' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('id');
    expect(resposta.body).to.have.property('name');
    expect(resposta.body).to.have.property('invite_code');
    expect(resposta.body).to.have.property('tolerance_percentage');
  });

  it('deve criar casa com nome que contém espaços e acentos', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Casa dos Moradores da Rua' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('id');
    expect(resposta.body).to.have.property('name', 'Casa dos Moradores da Rua');
  });

  it('deve retornar código de convite visível ao criador', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Casa do Código Visível' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.invite_code).to.be.a('string').with.length.above(0);
  });

  it('deve criar casa com tolerância padrão de 10%', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Casa Tolerância Default' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body.tolerance_percentage).to.equal(fixture.toleranciaDefault);
  });

  it('deve retornar ID único para cada casa criada', async function () {
    const [r1, r2] = await Promise.all([
      request(app).post('/api/houses').set('Authorization', `Bearer ${tokenAdmin}`).send({ name: 'Casa Unique A' }),
      request(app).post('/api/houses').set('Authorization', `Bearer ${tokenAdmin}`).send({ name: 'Casa Unique B' }),
    ]);

    expect(r1.body.id).to.not.equal(r2.body.id);
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando nome está ausente', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando nome está vazio', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: '' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando nome contém apenas espaços', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: '   ' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .send({ name: 'Casa Sem Token' });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 com token inválido', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', 'Bearer token.invalido.aqui')
      .send({ name: 'Casa Token Inválido' });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Casa Json Test' });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
