require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/preferences/data');

describe('GET /api/houses/:houseId/preferences — Listar Preferências do Usuário', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let tokenForaDaCasa;
  let houseId;
  let tarefaId;

  before(async function () {
    limparBancoDados();

    const foraData = { name: 'Fora Pref', email: 'fora.pref@test.com', password: 'senha123' };

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);
    await registrarUsuario(foraData);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.morador.email, fixture.morador.password);
    tokenForaDaCasa = await obterToken(foraData.email, foraData.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);

    const tarefa = await criarTarefa(tokenAdmin, houseId, fixture.tarefa);
    tarefaId = tarefa.id;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método GET', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app).get(`/api/houses/${houseId}/preferences`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando usuário não é membro da casa', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences`)
      .set('Authorization', `Bearer ${tokenForaDaCasa}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve retornar array de preferências do usuário autenticado', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array');
  });

  it('deve retornar uma entrada por tarefa ativa do catálogo', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.lengthOf(1);
  });

  it('deve retornar campos obrigatórios em cada preferência', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(200);
    const pref = resposta.body[0];
    ['task_id', 'task_name', 'effort_level', 'preference_level', 'has_physical_limitation'].forEach(campo => {
      expect(pref).to.have.property(campo);
    });
  });

  it('deve retornar preferência_level neutro como padrão quando não registrado', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(200);
    const pref = resposta.body.find(p => p.task_id === tarefaId);
    expect(pref).to.exist;
    expect(pref.preference_level).to.equal('neutral');
  });

  it('deve refletir preferência registrada pelo usuário', async function () {
    await request(app)
      .put(`/api/houses/${houseId}/preferences/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send(fixture.preferenciaValida);

    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(200);
    const pref = resposta.body.find(p => p.task_id === tarefaId);
    expect(pref.preference_level).to.equal(fixture.preferenciaValida.preference_level);
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/preferences`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
