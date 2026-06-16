require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin } = require('../helpers/auth.helper');
const fixture = require('../fixtures/members/invite');

describe('POST /api/houses/:houseId/members/invite — Convidar Membro', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);
    await registrarUsuario(fixture.novoUsuario);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    const tokenMoradorTemp = await obterToken(fixture.morador.email, fixture.morador.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa dos Membros');
    houseId = casa.id;

    await request(app)
      .post('/api/houses/join')
      .set('Authorization', `Bearer ${tokenMoradorTemp}`)
      .send({ invite_code: casa.invite_code });

    tokenMorador = tokenMoradorTemp;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método POST', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: 'verb.invite.test@inexistente.com' });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve enviar convite para usuário cadastrado e retornar objeto de convite', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: fixture.novoUsuario.email });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('invitation_id');
    expect(resposta.body).to.have.property('invited_user');
    expect(resposta.body).to.have.property('status', 'pending');
    expect(resposta.body.invited_user).to.have.property('email', fixture.novoUsuario.email);
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando email está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 quando usuário com email informado não existe', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: 'nao.existe.mesmo@test.com' });

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 409 quando usuário já é membro da casa', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: fixture.morador.email });

    expect(resposta.status).to.equal(409);
    expect(resposta.body).to.have.property('error');
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 403 quando morador (residente) tenta convidar membro', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ email: 'qualquer@test.com' });

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .send({ email: fixture.novoUsuario.email });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: 'json.members@test.com' });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
