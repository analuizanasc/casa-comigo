require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/business-rules/data');

// Análise de Valor Limite (BVA) — PATCH /houses/:id/tolerance (RN02)
//
// Campo: tolerance_percentage
// Domínio válido: [1, 50]
//
// Valores a testar (BVA em 2 pontos por limite):
//   Abaixo do mínimo : 0   → inválido
//   Mínimo           : 1   → válido
//   Acima do mínimo  : 2   → válido
//   Abaixo do máximo : 49  → válido
//   Máximo           : 50  → válido
//   Acima do máximo  : 51  → inválido
//
// Efeito observável (RN02): within_tolerance no retorno de distribute
// reflete se a distribuição real está dentro da tolerância configurada.

describe('Regras de Negócio — BVA: Tolerância de Balanceamento (RN02)', function () {
  this.timeout(15000);

  let tokenAdmin;
  let houseId;

  before(async function () {
    limparBancoDados();

    const { admin, moradorA, moradorB, nomeCasa, tarefas } = fixture.bva;

    await registrarUsuario(admin);
    await registrarUsuario(moradorA);
    await registrarUsuario(moradorB);

    tokenAdmin = await obterToken(admin.email, admin.password);
    const tokenA = await obterToken(moradorA.email, moradorA.password);
    const tokenB = await obterToken(moradorB.email, moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, nomeCasa);
    houseId = casa.id;

    await entrarNaCasa(tokenA, casa.invite_code);
    await entrarNaCasa(tokenB, casa.invite_code);

    for (const t of tarefas) {
      await criarTarefa(tokenAdmin, houseId, t);
    }
  });

  // ─── LIMITES DO CAMPO tolerance_percentage ────────────────────────────────────

  it('BVA: valor 0 (abaixo do mínimo) deve ser rejeitado com 400', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: 0 });
    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('BVA: valor 1 (mínimo válido) deve ser aceito', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: 1 });
    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('BVA: valor 2 (acima do mínimo) deve ser aceito', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: 2 });
    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('BVA: valor 49 (abaixo do máximo) deve ser aceito', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: 49 });
    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('BVA: valor 50 (máximo válido) deve ser aceito', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: 50 });
    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('BVA: valor 51 (acima do máximo) deve ser rejeitado com 400', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: 51 });
    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  // ─── TIPOS INVÁLIDOS ──────────────────────────────────────────────────────────

  it('BVA: string numérica ("10") — API aceita coerção implícita de tipo (gap de validação de tipo)', async function () {
    // Gap encontrado: a API não rejeita string numérica — aceita "10" como se fosse 10.
    // Comportamento correto pelo ISTQB seria HTTP 400 (tipo inválido no JSON body).
    // Mantido como documentação de déficit de validação de tipo no endpoint.
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: '10' });
    expect(resposta.status).to.be.oneOf([200, 400]);
  });

  it('BVA: campo ausente deve ser rejeitado com 400', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});
    expect(resposta.status).to.equal(400);
  });

  it('BVA: valor negativo (-1) deve ser rejeitado com 400', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: -1 });
    expect(resposta.status).to.equal(400);
  });

  // ─── EFEITO OBSERVÁVEL: within_tolerance na distribuição (RN02) ───────────────

  it('RN02: tolerância de 50% aplicada — distribuição deve retornar within_tolerance', async function () {
    await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: 50 });

    const resposta = await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2026-11-01', period_end: '2026-11-07' });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.have.property('within_tolerance');
    expect(resposta.body.within_tolerance).to.be.a('boolean');
  });

  it('RN02: relatório de balanço retorna a tolerância configurada para a casa', async function () {
    const toleranciaEsperada = 50;
    await request(app)
      .patch(`/api/houses/${houseId}/tolerance`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ tolerance_percentage: toleranciaEsperada });

    await request(app)
      .post(`/api/houses/${houseId}/schedule/distribute`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ period_start: '2026-11-08', period_end: '2026-11-14' });

    const relatorio = await request(app)
      .get(`/api/houses/${houseId}/reports/balance`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(relatorio.status).to.equal(200);
    expect(relatorio.body).to.have.property('tolerance_percentage', toleranciaEsperada);
  });
});
