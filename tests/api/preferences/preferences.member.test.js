require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/preferences/data');

describe('GET /api/houses/:houseId/preferences/member/:userId — Preferências de Membro (admin)', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;
  let moradorId;
  let tarefaId;

  before(async function () {
    limparBancoDados();

    const adminData = { name: 'Admin PrefMemb', email: 'admin.prefmemb@test.com', password: 'senha123' };
    const moradorData = { name: 'Morador PrefMemb', email: 'morador.prefmemb@test.com', password: 'senha123' };

    await registrarUsuario(adminData);
    await registrarUsuario(moradorData);

    tokenAdmin = await obterToken(adminData.email, adminData.password);
    tokenMorador = await obterToken(moradorData.email, moradorData.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Pref Membro Admin');
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);
    moradorId = obterIdUsuario(moradorData.email);

    const tarefa = await criarTarefa(tokenAdmin, houseId, {
      name: 'Tarefa PrefMemb',
      frequency: 'weekly',
      effort_level: 'light',
    });
    tarefaId = tarefa.id;

    await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ preference_level: 'like', has_physical_limitation: false });
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences/member/${moradorId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences/member/${moradorId}`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta acessar preferências de outro membro (RN06)', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences/member/${moradorId}`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('admin deve listar preferências de qualquer membro', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences/member/${moradorId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array');
  });

  it('deve retornar preferência registrada pelo membro', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences/member/${moradorId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    const pref = resposta.body.find(p => p.task_id === tarefaId);
    expect(pref).to.exist;
    expect(pref.preference_level).to.equal('like');
  });

  it('deve retornar lista vazia quando membro não tem preferências registradas', async function () {
    const adminId = obterIdUsuario('admin.prefmemb@test.com');

    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences/member/${adminId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array').that.is.empty;
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences/member/${moradorId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
