require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, criarTarefa } = require('../helpers/auth.helper');
const fixture = require('../fixtures/catalog/dependency-delete');

describe('DELETE /api/houses/:houseId/catalog/:taskId/dependencies/:dependsOnId — Remover Dependência (EP02-US04)', function () {
  this.timeout(5000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;
  let tarefaPrincipalId;
  let tarefaDependenciaId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.morador.email, fixture.morador.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    const { entrarNaCasa } = require('../helpers/auth.helper');
    await entrarNaCasa(tokenMorador, casa.invite_code);

    const tarefaPrincipal = await criarTarefa(tokenAdmin, houseId, fixture.tarefaPrincipal);
    const tarefaDependencia = await criarTarefa(tokenAdmin, houseId, fixture.tarefaDependencia);

    tarefaPrincipalId = tarefaPrincipal.id;
    tarefaDependenciaId = tarefaDependencia.id;

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${tarefaPrincipalId}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: tarefaDependenciaId });
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método DELETE', async function () {
    const t1 = await criarTarefa(tokenAdmin, houseId, { name: 'Dep Verb A', frequency: 'weekly', effort_level: 'light' });
    const t2 = await criarTarefa(tokenAdmin, houseId, { name: 'Dep Verb B', frequency: 'weekly', effort_level: 'light' });

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${t1.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: t2.id });

    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${t1.id}/dependencies/${t2.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefaPrincipalId}/dependencies/${tarefaDependenciaId}`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta remover dependência (RN06)', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefaPrincipalId}/dependencies/${tarefaDependenciaId}`)
      .set('Authorization', `Bearer ${tokenMorador}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve remover dependência existente e retornar sucesso (EP02-US04)', async function () {
    const t1 = await criarTarefa(tokenAdmin, houseId, { name: 'Del Dep A', frequency: 'weekly', effort_level: 'light' });
    const t2 = await criarTarefa(tokenAdmin, houseId, { name: 'Del Dep B', frequency: 'weekly', effort_level: 'light' });

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${t1.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: t2.id });

    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${t1.id}/dependencies/${t2.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('dependência removida não deve aparecer nos detalhes da tarefa', async function () {
    const t1 = await criarTarefa(tokenAdmin, houseId, { name: 'Check Dep A', frequency: 'weekly', effort_level: 'light' });
    const t2 = await criarTarefa(tokenAdmin, houseId, { name: 'Check Dep B', frequency: 'weekly', effort_level: 'light' });

    await request(app)
      .post(`/api/houses/${houseId}/catalog/${t1.id}/dependencies`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ depends_on_task_id: t2.id });

    await request(app)
      .delete(`/api/houses/${houseId}/catalog/${t1.id}/dependencies/${t2.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const detalhe = await request(app)
      .get(`/api/houses/${houseId}/catalog/${t1.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const dependencias = detalhe.body.dependencies || [];
    const encontrada = dependencias.find(d => d.id === t2.id);
    expect(encontrada).to.be.undefined;
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 404 quando dependência não existe', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/${tarefaPrincipalId}/dependencies/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 quando taskId não existe', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/00000000-0000-0000-0000-000000000000/dependencies/${tarefaDependenciaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json em caso de erro', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/catalog/00000000-0000-0000-0000-000000000000/dependencies/00000000-0000-0000-0000-000000000001`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
