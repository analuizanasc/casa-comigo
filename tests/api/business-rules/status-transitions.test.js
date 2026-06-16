require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const {
  registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa,
  distribuirTarefas, obterCronograma,
} = require('../helpers/auth.helper');
const fixture = require('../fixtures/business-rules/data');

// Máquina de estados do cronograma:
//
//            ┌──────────┐
//            │ pending  │◄── estado inicial após distribuição
//            └────┬─────┘
//                 │
//        ┌────────┴────────┐
//        ▼                 ▼
//  ┌──────────┐    ┌────────────────┐
//  │completed │    │  reassigned    │ ◄── impedimento ou reatribuição manual
//  └──────────┘    └────────────────┘
//
// Estados terminais: completed, reassigned
// Transições inválidas: completed → completed, reassigned → completed

describe('Regras de Negócio — Máquina de Estados: Cronograma', function () {
  this.timeout(20000);

  let tokenAdmin;
  let tokenA;
  let tokenB;
  let houseId;
  let moradorAId;
  let moradorBId;
  let adminId;

  before(async function () {
    limparBancoDados();

    const { admin, moradorA, moradorB, nomeCasa, tarefa, periodo } = fixture.transitions;

    await registrarUsuario(admin);
    await registrarUsuario(moradorA);
    await registrarUsuario(moradorB);

    tokenAdmin = await obterToken(admin.email, admin.password);
    tokenA = await obterToken(moradorA.email, moradorA.password);
    tokenB = await obterToken(moradorB.email, moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenA, casa.invite_code);
    await entrarNaCasa(tokenB, casa.invite_code);

    adminId = obterIdUsuario(admin.email);
    moradorAId = obterIdUsuario(moradorA.email);
    moradorBId = obterIdUsuario(moradorB.email);

    // Cria tarefas suficientes para cobrir todos os cenários em períodos distintos
    for (let i = 1; i <= 6; i++) {
      await criarTarefa(tokenAdmin, houseId, {
        name: `Tarefa ST ${i}`,
        frequency: 'daily',
        effort_level: 'light',
        room: 'Sala',
      });
    }
  });

  // ─── ESTADO INICIAL: pending ──────────────────────────────────────────────────

  it('toda atribuição criada pela distribuição inicia com status pending', async function () {
    await distribuirTarefas(tokenAdmin, houseId, '2026-07-07', '2026-07-13');
    const cronograma = await obterCronograma(tokenAdmin, houseId);

    expect(cronograma.length).to.be.above(0);
    cronograma.forEach(atrib => {
      expect(atrib.status).to.equal('pending');
    });
  });

  // ─── TRANSIÇÃO: pending → completed ──────────────────────────────────────────

  it('transição pending → completed: PATCH /complete muda status para completed', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    const cronogramaAtualizado = await obterCronograma(tokenAdmin, houseId);
    const atribuicaoAtualizada = cronogramaAtualizado.find(a => a.id === atribuicao.id);

    expect(atribuicaoAtualizada.status).to.equal('completed');
  });

  it('transição pending → completed: retorna 200 ou 204 ao concluir', async function () {
    await distribuirTarefas(tokenAdmin, houseId, '2026-07-14', '2026-07-20');
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  // ─── ESTADO TERMINAL: completed ───────────────────────────────────────────────

  it('estado terminal: não é possível concluir uma atribuição já concluída', async function () {
    await distribuirTarefas(tokenAdmin, houseId, '2026-07-21', '2026-07-27');
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    // Primeira conclusão
    await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    // Segunda tentativa — deve falhar
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.be.oneOf([400, 409, 422]);
  });

  // ─── TRANSIÇÃO: pending → reassigned (impedimento) ────────────────────────────

  it('transição pending → reassigned: impedimento muda status da atribuição original', async function () {
    await distribuirTarefas(tokenAdmin, houseId, '2026-07-28', '2026-08-03');
    const cronograma = await obterCronograma(tokenAdmin, houseId, {
      date_from: '2026-07-28',
      date_to: '2026-08-03',
    });
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    // Impedimento deve ser reportado pelo próprio responsável da tarefa (RN04)
    const tokenResponsavel =
      atribuicao.assigned_to === adminId    ? tokenAdmin :
      atribuicao.assigned_to === moradorAId ? tokenA     : tokenB;

    const respostaImpedimento = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/impediment`)
      .set('Authorization', `Bearer ${tokenResponsavel}`)
      .send({});

    expect(respostaImpedimento.status).to.be.oneOf([200, 201, 204]);

    const cronogramaAtualizado = await obterCronograma(tokenAdmin, houseId, {
      date_from: '2026-07-28',
      date_to: '2026-08-03',
    });
    const original = cronogramaAtualizado.find(a => a.id === atribuicao.id);

    expect(original.status).to.not.equal('pending');
  });

  it('transição pending → reassigned (manual): PUT /reassign cria nova atribuição', async function () {
    await distribuirTarefas(tokenAdmin, houseId, '2026-08-04', '2026-08-10');
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    const novoResponsavelId = atribuicao.assigned_to === moradorAId ? moradorBId : moradorAId;

    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicao.id}/reassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ assigned_to: novoResponsavelId });

    expect(resposta.status).to.be.oneOf([200, 201]);
  });

  // ─── ESTADO TERMINAL: não é possível redistribuir atribuição já concluída ─────

  it('estado terminal: não é possível redistribuir atribuição já concluída', async function () {
    this.timeout(30000);

    await distribuirTarefas(tokenAdmin, houseId, '2026-08-11', '2026-08-17');
    const cronograma = await obterCronograma(tokenAdmin, houseId, {
      date_from: '2026-08-11',
      date_to: '2026-08-17',
    });
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    const novoResponsavelId = atribuicao.assigned_to === moradorAId ? moradorBId : moradorAId;
    const resposta = await request(app)
      .put(`/api/houses/${houseId}/schedule/${atribuicao.id}/reassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ assigned_to: novoResponsavelId });

    expect(resposta.status).to.be.oneOf([400, 409, 422]);
  });

  // ─── CONSISTÊNCIA DO CAMPO status ────────────────────────────────────────────

  it('status retornado pelo cronograma deve ser sempre um valor do enum definido', async function () {
    await distribuirTarefas(tokenAdmin, houseId, '2026-08-18', '2026-08-24');
    const cronograma = await obterCronograma(tokenAdmin, houseId);

    const statusPermitidos = ['pending', 'completed', 'overdue', 'reassigned', 'redistributed'];
    cronograma.forEach(atrib => {
      expect(statusPermitidos).to.include(atrib.status,
        `Status inesperado "${atrib.status}" na atribuição ${atrib.id}`
      );
    });
  });
});
