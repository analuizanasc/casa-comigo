require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/security/data');

describe('Segurança — Acesso Cruzado Entre Casas', function () {
  this.timeout(10000);

  let tokenAdminA;
  let tokenMembroA;
  let tokenAdminB;
  let houseIdA;
  let houseIdB;
  let tarefaIdB;

  before(async function () {
    limparBancoDados();

    // Casa A: admin + membro
    await registrarUsuario(fixture.casaA.admin);
    await registrarUsuario(fixture.casaA.membro);
    tokenAdminA = await obterToken(fixture.casaA.admin.email, fixture.casaA.admin.password);
    const tokenMembroATemp = await obterToken(fixture.casaA.membro.email, fixture.casaA.membro.password);

    const casaA = await criarCasaComAdmin(tokenAdminA, fixture.casaA.nomeCasa);
    houseIdA = casaA.id;
    await entrarNaCasa(tokenMembroATemp, casaA.invite_code);
    tokenMembroA = tokenMembroATemp;

    // Casa B: admin separado
    await registrarUsuario(fixture.casaB.admin);
    tokenAdminB = await obterToken(fixture.casaB.admin.email, fixture.casaB.admin.password);
    const casaB = await criarCasaComAdmin(tokenAdminB, fixture.casaB.nomeCasa);
    houseIdB = casaB.id;

    // Tarefa na Casa B (criada pelo admin B)
    const tarefa = await criarTarefa(tokenAdminB, houseIdB, fixture.tarefa);
    tarefaIdB = tarefa.id;
  });

  // ─── MEMBROS ─────────────────────────────────────────────────────────────────

  it('membro da Casa A não pode listar membros da Casa B', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseIdB}/members`)
      .set('Authorization', `Bearer ${tokenMembroA}`);
    expect(resposta.status).to.equal(403);
  });

  it('admin da Casa A não pode listar membros da Casa B', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseIdB}/members`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(resposta.status).to.equal(403);
  });

  it('membro da Casa A não pode remover membro da Casa B', async function () {
    const membrosB = await request(app)
      .get(`/api/houses/${houseIdB}/members`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    const membroId = membrosB.body[0]?.user_id;

    const resposta = await request(app)
      .delete(`/api/houses/${houseIdB}/members/${membroId}`)
      .set('Authorization', `Bearer ${tokenMembroA}`);
    expect(resposta.status).to.equal(403);
  });

  // ─── CATÁLOGO ─────────────────────────────────────────────────────────────────

  it('membro da Casa A não pode ver o catálogo da Casa B', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseIdB}/catalog`)
      .set('Authorization', `Bearer ${tokenMembroA}`);
    expect(resposta.status).to.equal(403);
  });

  it('membro da Casa A não pode criar tarefa no catálogo da Casa B', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseIdB}/catalog`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ name: 'Tarefa Invasão', frequency: 'weekly', effort_level: 'light' });
    expect(resposta.status).to.equal(403);
  });

  it('admin da Casa A não pode deletar tarefa da Casa B', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseIdB}/catalog/${tarefaIdB}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(resposta.status).to.equal(403);
  });

  // ─── CRONOGRAMA ──────────────────────────────────────────────────────────────

  it('membro da Casa A não pode ver cronograma da Casa B', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseIdB}/schedule`)
      .set('Authorization', `Bearer ${tokenMembroA}`);
    expect(resposta.status).to.equal(403);
  });

  it('admin da Casa A não pode distribuir tarefas na Casa B', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseIdB}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ period_start: '2026-09-01', period_end: '2026-09-07' });
    expect(resposta.status).to.equal(403);
  });

  // ─── PREFERÊNCIAS ─────────────────────────────────────────────────────────────

  it('membro da Casa A não pode ver preferências da Casa B', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseIdB}/preferences`)
      .set('Authorization', `Bearer ${tokenMembroA}`);
    expect(resposta.status).to.equal(403);
  });

  // ─── TOLERÂNCIA ──────────────────────────────────────────────────────────────

  it('admin da Casa A não pode alterar tolerância da Casa B', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseIdB}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ tolerance_percentage: 5 });
    expect(resposta.status).to.equal(403);
  });

  // ─── RELATÓRIOS ──────────────────────────────────────────────────────────────

  it('membro da Casa A não pode ver relatórios da Casa B', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseIdB}/reports/balance`)
      .set('Authorization', `Bearer ${tokenMembroA}`);
    expect(resposta.status).to.equal(403);
  });

  // ─── CABEÇALHOS DE ERRO ───────────────────────────────────────────────────────

  it('todas as respostas 403 de cross-house devem retornar JSON com campo error', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseIdB}/members`)
      .set('Authorization', `Bearer ${tokenMembroA}`);
    expect(resposta.status).to.equal(403);
    expect(resposta.headers['content-type']).to.match(/application\/json/);
    expect(resposta.body).to.have.property('error');
  });
});
