require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/members/availability');

describe('PUT /api/houses/:houseId/members/:userId/availability — Disponibilidade Semanal (EP01-US02)', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;
  let moradorId;
  let adminId;

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
    adminId = obterIdUsuario(fixture.admin.email);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método PUT', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weekly_availability_hours: fixture.horasValidas });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .send({ weekly_availability_hours: fixture.horasValidas });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('morador deve poder atualizar sua própria disponibilidade (EP01-US02)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ weekly_availability_hours: 8 });

    expect(resposta.status).to.equal(200);
  });

  it('admin deve poder atualizar disponibilidade de qualquer membro', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weekly_availability_hours: fixture.horasValidas });

    expect(resposta.status).to.equal(200);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve atualizar disponibilidade com horas válidas e retornar mensagem', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weekly_availability_hours: fixture.horasValidas });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('message');
  });

  it('deve aceitar zero horas (membro indisponível)', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weekly_availability_hours: fixture.horasZero });

    expect(resposta.status).to.equal(200);
  });

  it('deve refletir a nova disponibilidade na listagem de membros', async function () {
    const novasHoras = 15;

    await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weekly_availability_hours: novasHoras });

    const listagem = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const membro = listagem.body.find(m => m.user_id === moradorId);
    expect(membro.weekly_availability_hours).to.equal(novasHoras);
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando horas são negativas', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weekly_availability_hours: fixture.horasNegativas });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando weekly_availability_hours está ausente', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorId}/availability`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ weekly_availability_hours: 10 });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
