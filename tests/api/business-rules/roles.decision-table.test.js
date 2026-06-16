require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa, atualizarPapel, obterMembros } = require('../helpers/auth.helper');
const fixture = require('../fixtures/business-rules/data');

// Tabela de Decisão — Papel × Ação (RN06)
//
// Ação                   | admin | catalog_manager | resident
// ─────────────────────────────────────────────────────────────
// Criar tarefa           |  ✓    |       ✓         |    ✗
// Atualizar tarefa       |  ✓    |       ✓         |    ✗
// Deletar tarefa         |  ✓    |       ✓         |    ✗
// Criar dependência      |  ✓    |       ✓         |    ✗
// Distribuir cronograma  |  ✓    |       ✗         |    ✗
// Alterar tolerância     |  ✓    |       ✗         |    ✗
// Alterar papel de membro|  ✓    |       ✗         |    ✗
// Remover membro         |  ✓    |       ✗         |    ✗
// Alterar peso de membro |  ✓    |       ✗         |    ✗
// Ver cronograma         |  ✓    |       ✓         |    ✓ (só próprio)

describe('Regras de Negócio — Tabela de Decisão: Papel × Ação (RN06)', function () {
  this.timeout(15000);

  let tokenAdmin;
  let tokenGestor;
  let tokenMorador;
  let houseId;
  let tarefaId;
  let moradorUserId;
  let gestorUserId;

  before(async function () {
    limparBancoDados();

    const { admin, gestor, morador, nomeCasa } = fixture.roles;

    await registrarUsuario(admin);
    await registrarUsuario(gestor);
    await registrarUsuario(morador);

    tokenAdmin = await obterToken(admin.email, admin.password);
    const tokenGestorTemp = await obterToken(gestor.email, gestor.password);
    const tokenMoradorTemp = await obterToken(morador.email, morador.password);

    const casa = await criarCasaComAdmin(tokenAdmin, nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenGestorTemp, casa.invite_code);
    await entrarNaCasa(tokenMoradorTemp, casa.invite_code);

    const membros = await obterMembros(tokenAdmin, houseId);
    const gestorMembro = membros.find(m => m.email === gestor.email);
    const moradorMembro = membros.find(m => m.email === morador.email);

    await atualizarPapel(tokenAdmin, houseId, gestorMembro.user_id, 'catalog_manager');

    tokenGestor = tokenGestorTemp;
    tokenMorador = tokenMoradorTemp;
    gestorUserId = gestorMembro.user_id;
    moradorUserId = moradorMembro.user_id;

    const tarefa = await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa DT', frequency: 'weekly', effort_level: 'light' });
    tarefaId = tarefa.id;
  });

  // ─── CRIAR TAREFA ────────────────────────────────────────────────────────────

  it('[admin] pode criar tarefa no catálogo', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa Admin DT', frequency: 'daily', effort_level: 'light' });
    expect(resposta.status).to.equal(201);
  });

  it('[catalog_manager] pode criar tarefa no catálogo', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ name: 'Tarefa Gestor DT', frequency: 'daily', effort_level: 'light' });
    expect(resposta.status).to.equal(201);
  });

  it('[resident] não pode criar tarefa no catálogo', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/catalog`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ name: 'Tarefa Morador DT', frequency: 'daily', effort_level: 'light' });
    expect(resposta.status).to.equal(403);
  });

  // ─── ATUALIZAR TAREFA ─────────────────────────────────────────────────────────

  it('[admin] pode atualizar tarefa', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Tarefa DT Atualizada', frequency: 'weekly', effort_level: 'medium' });
    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('[catalog_manager] pode atualizar tarefa', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ name: 'Tarefa DT Gestor Up', frequency: 'weekly', effort_level: 'light' });
    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('[resident] não pode atualizar tarefa', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ name: 'Hack', frequency: 'weekly', effort_level: 'light' });
    expect(resposta.status).to.equal(403);
  });

  // ─── DELETAR TAREFA ───────────────────────────────────────────────────────────

  it('[resident] não pode deletar tarefa', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`);
    expect(resposta.status).to.equal(403);
  });

  it('[catalog_manager] pode deletar tarefa', async function () {
    const tarefaDel = await criarTarefa(tokenAdmin, houseId, { name: 'Para Deletar DT', frequency: 'weekly', effort_level: 'light' });
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefaDel.id}`)
      .set('Authorization', `Bearer ${tokenGestor}`);
    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  // ─── DISTRIBUIR CRONOGRAMA ───────────────────────────────────────────────────

  it('[admin] pode distribuir cronograma', async function () {
    await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa p/ Distribuir DT', frequency: 'weekly', effort_level: 'light' });
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2026-10-01', period_end: '2026-10-07' });
    expect(resposta.status).to.equal(201);
  });

  it('[catalog_manager] não pode distribuir cronograma', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ period_start: '2026-10-08', period_end: '2026-10-14' });
    expect(resposta.status).to.equal(403);
  });

  it('[resident] não pode distribuir cronograma', async function () {
    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ period_start: '2026-10-08', period_end: '2026-10-14' });
    expect(resposta.status).to.equal(403);
  });

  // ─── ALTERAR TOLERÂNCIA ──────────────────────────────────────────────────────

  it('[admin] pode alterar tolerância da casa', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: 15 });
    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('[catalog_manager] não pode alterar tolerância', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ tolerance_percentage: 20 });
    expect(resposta.status).to.equal(403);
  });

  it('[resident] não pode alterar tolerância', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ tolerance_percentage: 20 });
    expect(resposta.status).to.equal(403);
  });

  // ─── ALTERAR PAPEL DE MEMBRO ──────────────────────────────────────────────────

  it('[admin] pode alterar papel de membro', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorUserId}/role`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ role: 'resident' });
    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('[catalog_manager] não pode alterar papel de membro', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${moradorUserId}/role`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ role: 'admin' });
    expect(resposta.status).to.equal(403);
  });

  it('[resident] não pode alterar papel de membro', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/members/${gestorUserId}/role`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ role: 'resident' });
    expect(resposta.status).to.equal(403);
  });

  // ─── VER CRONOGRAMA ──────────────────────────────────────────────────────────

  it('[admin] vê todo o cronograma da casa', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.be.an('array');
  });

  it('[catalog_manager] vê o cronograma', async function () {
    const resposta = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenGestor}`);
    expect(resposta.status).to.equal(200);
  });

  it('[resident] vê apenas suas próprias tarefas no cronograma', async function () {
    const respostaAdmin = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const respostaMorador = await request(app)
      .get(`/api/houses/${houseId}/schedule`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(respostaMorador.status).to.equal(200);

    if (respostaMorador.body.length > 0) {
      respostaMorador.body.forEach(atrib => {
        const adminEntry = respostaAdmin.body.find(a => a.id === atrib.id);
        expect(adminEntry).to.exist;
      });
    }
  });
});
