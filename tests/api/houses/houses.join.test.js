require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin } = require('../helpers/auth.helper');
const fixture = require('../fixtures/houses/join');

describe('POST /api/houses/join — Entrar em Casa via Código de Convite', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenNovoMembro;
  let casaCriada;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.novoMembro);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenNovoMembro = await obterToken(fixture.novoMembro.email, fixture.novoMembro.password);

    casaCriada = await criarCasaComAdmin(tokenAdmin, 'Casa do Convite');
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({ invite_code: 'VERB999' });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve entrar na casa com código de convite válido e retornar dados da casa', async function () {
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({ invite_code: casaCriada.invite_code });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('id', casaCriada.id);
    expect(resposta.body).to.have.property('name');
    expect(resposta.body).to.have.property('tolerance_percentage');
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando código de convite está ausente', async function () {
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 com código de convite inexistente', async function () {
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({ invite_code: 'INVALIDO' });

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 com código de convite malformado', async function () {
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({ invite_code: '!!!###' });

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 409 quando usuário já é membro da casa', async function () {
    // Garante que novoMembro é membro antes de tentar entrar novamente
    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({ invite_code: casaCriada.invite_code });

    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({ invite_code: casaCriada.invite_code });

    expect(resposta.status).to.equal(409);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .post('/api/houses/join')
      .send({ invite_code: casaCriada.invite_code });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenNovoMembro}`)
      .send({ invite_code: 'QUALQUER' });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
