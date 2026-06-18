require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const {
  registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, criarTarefa, distribuirTarefas, obterCronograma,
} = require('../helpers/auth.helper');

describe('PATCH /api/houses/:houseId/schedule/:assignmentId/impediment — Reportar Impedimento (EP04-US05 / RN04 / RN05)', function () {
  this.timeout(15000);

  let tokenAdmin;
  let tokenResponsavel;
  let tokenOutroMembro;
  let houseId;
  let adminId;

  before(async function () {
    limparBancoDados();

    const adminData = { name: 'Admin Impediment', email: 'admin.impediment@test.com', password: 'senha123' };
    const moradorA = { name: 'Responsavel Imp', email: 'resp.imp@test.com', password: 'senha123' };
    const moradorB = { name: 'Outro Imp', email: 'outro.imp@test.com', password: 'senha123' };

    await registrarUsuario(adminData);
    await registrarUsuario(moradorA);
    await registrarUsuario(moradorB);

    tokenAdmin = await obterToken(adminData.email, adminData.password);
    tokenResponsavel = await obterToken(moradorA.email, moradorA.password);
    tokenOutroMembro = await obterToken(moradorB.email, moradorB.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Impedimento');
    houseId = casa.id;

    await entrarNaCasa(tokenResponsavel, casa.invite_code);
    await entrarNaCasa(tokenOutroMembro, casa.invite_code);

    adminId = obterIdUsuario(adminData.email);

    await criarTarefa(tokenAdmin, houseId, { name: 'Tarefa Impedimento', frequency: 'weekly', effort_level: 'light' });

    await distribuirTarefas(tokenAdmin, houseId, '2027-02-01', '2027-02-07');
  });

  function obterAtribuicaoDoMembro(cronograma, token) {
    return cronograma.find(a => a.status === 'pending');
  }

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método PATCH', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    const tokenResponsavelAtribuicao = atribuicao.assigned_to === obterIdUsuario('admin.impediment@test.com')
      ? tokenAdmin
      : atribuicao.assigned_to === obterIdUsuario('resp.imp@test.com')
        ? tokenResponsavel
        : tokenOutroMembro;

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/impediment`)
      .set('Authorization', `Bearer ${tokenResponsavelAtribuicao}`)
      .send({});

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/impediment`)
      .send({});

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando membro tenta reportar impedimento em tarefa de outro (RN04)', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    const idAdmin = obterIdUsuario('admin.impediment@test.com');
    const idResp = obterIdUsuario('resp.imp@test.com');
    const idOutro = obterIdUsuario('outro.imp@test.com');

    let tokenNaoResponsavel;
    if (atribuicao.assigned_to === idAdmin) {
      tokenNaoResponsavel = tokenResponsavel;
    } else if (atribuicao.assigned_to === idResp) {
      tokenNaoResponsavel = tokenOutroMembro;
    } else {
      tokenNaoResponsavel = tokenAdmin;
    }

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/impediment`)
      .set('Authorization', `Bearer ${tokenNaoResponsavel}`)
      .send({});

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve redistribuir tarefa para outro membro e retornar nova atribuição (RN04)', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    const idAdmin = obterIdUsuario('admin.impediment@test.com');
    const idResp = obterIdUsuario('resp.imp@test.com');
    const idOutro = obterIdUsuario('outro.imp@test.com');

    let tokenAtribuido;
    if (atribuicao.assigned_to === idAdmin) {
      tokenAtribuido = tokenAdmin;
    } else if (atribuicao.assigned_to === idResp) {
      tokenAtribuido = tokenResponsavel;
    } else {
      tokenAtribuido = tokenOutroMembro;
    }

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/impediment`)
      .set('Authorization', `Bearer ${tokenAtribuido}`)
      .send({});

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('new_assignment');
    expect(resposta.body.new_assignment).to.have.property('assigned_to');
    expect(resposta.body.new_assignment.assigned_to).to.not.equal(atribuicao.assigned_to);
  });

  it('deve retornar mensagem de confirmação e nova atribuição (RN04)', async function () {
    const cronograma = await obterCronograma(tokenAdmin, houseId);
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    const idAdmin = obterIdUsuario('admin.impediment@test.com');
    const idResp = obterIdUsuario('resp.imp@test.com');

    let tokenAtribuido;
    if (atribuicao.assigned_to === idAdmin) {
      tokenAtribuido = tokenAdmin;
    } else if (atribuicao.assigned_to === idResp) {
      tokenAtribuido = tokenResponsavel;
    } else {
      tokenAtribuido = tokenOutroMembro;
    }

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/impediment`)
      .set('Authorization', `Bearer ${tokenAtribuido}`)
      .send({});

    expect(resposta.status).to.equal(200);
    expect(resposta.body).to.have.property('message');
    expect(resposta.body).to.have.property('new_assignment');
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 ao tentar reportar impedimento em tarefa já concluída', async function () {
    await distribuirTarefas(tokenAdmin, houseId, '2027-03-01', '2027-03-07');
    const cronograma = await obterCronograma(tokenAdmin, houseId, { start: '2027-03-01', end: '2027-03-07' });
    const atribuicao = cronograma.find(a => a.status === 'pending');
    if (!atribuicao) return this.skip();

    const idAdmin = obterIdUsuario('admin.impediment@test.com');
    const idResp = obterIdUsuario('resp.imp@test.com');

    let tokenAtribuido;
    if (atribuicao.assigned_to === idAdmin) tokenAtribuido = tokenAdmin;
    else if (atribuicao.assigned_to === idResp) tokenAtribuido = tokenResponsavel;
    else tokenAtribuido = tokenOutroMembro;

    await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/complete`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/${atribuicao.id}/impediment`)
      .set('Authorization', `Bearer ${tokenAtribuido}`)
      .send({});

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 quando atribuição não existe', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/00000000-0000-0000-0000-000000000000/impediment`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json', async function () {
    const resposta = await request(app)
      .patch(`/api/houses/${houseId}/schedule/00000000-0000-0000-0000-000000000000/impediment`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({});

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
