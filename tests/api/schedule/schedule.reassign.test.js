require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const {
  registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa, distribuirTarefas, obterCronograma,
} = require('../helpers/auth.helper');

describe('PUT /api/houses/:houseId/schedule/:assignmentId/reassign — Reatribuição Manual (EP04-US04)', function () {
  this.timeout(15000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;
  let atribuicaoId;
  let moradorId;

  before(async function () {
    limparBancoDados();

    const adminData = { name: 'Admin Reassign', email: 'admin.reassign@test.com', password: 'senha123' };
    const moradorData = { name: 'Morador Reassign', email: 'morador.reassign@test.com', password: 'senha123' };
    const moradorB = { name: 'Morador Reassign B', email: 'morador.reassignb@test.com', password: 'senha123' };

    await registrarUsuario(adminData);
    await registrarUsuario(moradorData);
    await registrarUsuario(moradorB);

    tokenAdmin = await obterToken(adminData.email, adminData.password);
    tokenMorador = await obterToken(moradorData.email, moradorData.password);
    const tokenB = await obterToken(moradorB.email, moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Reatribuição');
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);
    await entrarNaCasa(tokenB, casa.invite_code);

    moradorId = obterIdUsuario(moradorData.email);

    await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa Reassign', frequency: 'weekly', effort_level: 'light' });

    await distribuirTarefas(tokenAdmin, houseId, '2026-12-01', '2026-12-07');

    const cronograma = await obterCronograma(tokenAdmin, houseId);
    atribuicaoId = cronograma[0].id;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método PUT', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicaoId}/reassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ assigned_to: moradorId });

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicaoId}/reassign`)
      .send({ assigned_to: moradorId });

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta reatribuir tarefa', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicaoId}/reassign`)
      .set('Authorization', `Bearer ${tokenMorador}`)
      .send({ assigned_to: moradorId });

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve reatribuir tarefa pendente para outro membro', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicaoId}/reassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ assigned_to: moradorId });

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('id', atribuicaoId);
    expect(resposta.body).to.have.property('assigned_to', moradorId);
  });

  it('deve retornar dados da atribuição atualizada com campos obrigatórios', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicaoId}/reassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ assigned_to: moradorId });

    expect(resposta.status).to.equal(200);
    ['id', 'task_id', 'task_name', 'assigned_to', 'assigned_to_name', 'scheduled_date', 'status'].forEach(campo => {
      expect(resposta.body).to.have.property(campo);
    });
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando assigned_to está ausente', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicaoId}/reassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 400 quando assigned_to não é membro da casa', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicaoId}/reassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ assigned_to: '00000000-0000-0000-0000-000000000000' });

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 quando atribuição não existe', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/00000000-0000-0000-0000-000000000000/reassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ assigned_to: moradorId });

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicaoId}/reassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ assigned_to: moradorId });

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
