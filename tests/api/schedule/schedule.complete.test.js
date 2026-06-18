require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const {
  registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa, distribuirTarefas, obterCronograma,
} = require('../helpers/auth.helper');

describe('PATCH /api/houses/:houseId/schedule/:assignmentId/complete — Concluir Tarefa (EP07-US01/US02 / RN09)', function () {
  this.timeout(15000);

  let tokenAdmin;
  let tokenResponsavel;
  let tokenOutroMembro;
  let houseId;
  let atribuicaoIdParaConcluir;
  let responsavelId;

  before(async function () {
    limparBancoDados();

    const adminData = { name: 'Admin Complete', email: 'admin.complete@test.com', password: 'senha123' };
    const moradorA = { name: 'Responsavel Complete', email: 'resp.complete@test.com', password: 'senha123' };
    const moradorB = { name: 'Outro Complete', email: 'outro.complete@test.com', password: 'senha123' };

    await registrarUsuario(adminData);
    await registrarUsuario(moradorA);
    await registrarUsuario(moradorB);

    tokenAdmin = await obterToken(adminData.email, adminData.password);
    tokenResponsavel = await obterToken(moradorA.email, moradorA.password);
    tokenOutroMembro = await obterToken(moradorB.email, moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Conclusão');
    houseId = casa.id;

    await entrarNaCasa(tokenResponsavel, casa.invite_code);
    await entrarNaCasa(tokenOutroMembro, casa.invite_code);

    responsavelId = obterIdUsuario(moradorA.email);

    for (let i = 1; i <= 6; i++) {
      await criarTarefa(tokenAdmin, houseId, { name: `Tarefa Complete ${i}`, frequency: 'daily', effort_level: 'light' });
    }

    await distribuirTarefas(tokenAdmin, houseId, '2027-01-01', '2027-01-07');

    const cronograma = await obterCronograma(tokenAdmin, houseId);
    atribuicaoIdParaConcluir = cronograma[0].id;
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método PATCH', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const idVerb = cronograma.find(a => a.status === 'pending')?.id;
    if (!idVerb) return this.skip();

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${idVerb}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicaoIdParaConcluir}/complete`)
      .send({});

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve marcar tarefa como concluída e retornar atribuição com status completed (RN09)', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const pendente = cronograma.find(a => a.status === 'pending');
    if (!pendente) return this.skip();

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${pendente.id}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('status', 'completed');
    expect(resposta.body).to.have.property('completed_at');
  });

  it('deve aceitar e persistir completion_notes (EP07-US02)', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const pendente = cronograma.find(a => a.status === 'pending');
    if (!pendente) return this.skip();

    const nota = 'Produto de limpeza acabou, precisa repor.';

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${pendente.id}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ completion_notes: nota });

    expect(resposta.status).to.equal(200);
    expect(resposta.body.completion_notes).to.equal(nota);
  });

  it('qualquer membro da casa pode concluir tarefa (não apenas responsável) — RN09', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const pendente = cronograma.find(a => a.status === 'pending');
    if (!pendente) return this.skip();

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${pendente.id}/complete`)
      .set('Authorization', `Bearer ${tokenOutroMembro}`)
      .send({});

    expect(resposta.status).to.equal(200);
    expect(resposta.body.status).to.equal('completed');
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 ao tentar concluir tarefa já concluída', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const concluida = cronograma.find(a => a.status === 'completed');
    if (!concluida) return this.skip();

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${concluida.id}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 quando atribuição não existe', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/00000000-0000-0000-0000-000000000000/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/00000000-0000-0000-0000-000000000000/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
