require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/members/list');

describe('GET /api/houses/:houseId/members — Listar Membros da Casa', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMoradorA;
  let tokenForaDaCasa;
  let houseId;

  before(async function () {
    limparBancoDados();

    const foraData = { name: 'Fora Membros', email: 'fora.membros@test.com', password: 'senha123' };

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.moradorA);
    await registrarUsuario(fixture.moradorB);
    await registrarUsuario(foraData);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMoradorA = await obterToken(fixture.moradorA.email, fixture.moradorA.password);
    const tokenMoradorB = await obterToken(fixture.moradorB.email, fixture.moradorB.password);
    tokenForaDaCasa = await obterToken(foraData.email, foraData.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenMoradorA, casa.invite_code);
    await entrarNaCasa(tokenMoradorB, casa.invite_code);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get(`/api/houses/${houseId}/members`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando usuário não é membro da casa (RNF05)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenForaDaCasa}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  it('morador da casa também pode listar membros', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenMoradorA}`);

    expect(resposta.status).to.equal(200);
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar todos os membros da casa (admin + 2 moradores)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').with.lengthOf(3);
  });

  it('deve retornar campos obrigatórios para cada membro', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    const membro = resposta.body[0];
    ['id', 'user_id', 'name', 'email', 'role', 'weekly_availability_hours', 'created_at'].forEach(campo => {
      expect(membro).to.have.property(campo);
    });
  });

  it('admin deve aparecer com role admin na lista', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    const admin = resposta.body.find(m => m.email === fixture.admin.email);
    expect(admin).to.exist;
    expect(admin.role).to.equal('admin');
  });

  it('moradores devem aparecer com role resident na lista', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    const morador = resposta.body.find(m => m.email === fixture.moradorA.email);
    expect(morador).to.exist;
    expect(morador.role).to.equal('resident');
  });

  it('não deve expor senha dos membros (RNF05)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    resposta.body.forEach(membro => {
      expect(membro).to.not.have.property('password');
      expect(membro).to.not.have.property('password_hash');
    });
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/members`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
