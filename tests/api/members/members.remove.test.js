require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados, obterIdUsuario } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin, entrarNaCasa, obterMembros } = require('../helpers/auth.helper');

describe('DELETE /api/houses/:houseId/members/:userId — Remover Membro (EP01-US06)', function () {
  this.timeout(10000);

  let tokenAdmin;
  let tokenMorador;
  let houseId;
  let moradorId;

  before(async function () {
    limparBancoDados();

    const adminData = { name: 'Admin Remove', email: 'admin.remove@test.com', password: 'senha123' };
    const moradorData = { name: 'Morador Remove', email: 'morador.remove@test.com', password: 'senha123' };

    await registrarUsuario(adminData);
    await registrarUsuario(moradorData);

    tokenAdmin = await obterToken(adminData.email, adminData.password);
    tokenMorador = await obterToken(moradorData.email, moradorData.password);

    const casa = await criarCasaComAdmin(tokenAdmin, 'Casa Remoção');
    houseId = casa.id;

    await entrarNaCasa(tokenMorador, casa.invite_code);

    moradorId = obterIdUsuario(moradorData.email);
  });

  // ─── VERB ────────────────────────────────────────────────────────────────────

  it('deve aceitar requisições com método DELETE', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/members/${moradorId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.not.equal(405);
  });

  // ─── AUTHORIZATION ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token de autorização está ausente', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/members/${moradorId}`);

    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 403 quando morador (residente) tenta remover outro membro (RN06)', async function () {
    const adminId = obterIdUsuario('admin.remove@test.com');
    const moradorAtualId = obterIdUsuario('morador.remove@test.com');

    const tokenMoradorAtual = await obterToken('morador.remove@test.com', 'senha123');

    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/members/${adminId}`)
      .set('Authorization', `Bearer ${tokenMoradorAtual}`);

    expect(resposta.status).to.equal(403);
    expect(resposta.body).to.have.property('error');
  });

  // ─── DATA ────────────────────────────────────────────────────────────────────

  it('deve remover membro da casa e retornar 204 ou mensagem de sucesso', async function () {
    const moradorParaRemover = { name: 'Para Remover', email: 'para.remover@test.com', password: 'senha123' };
    await registrarUsuario(moradorParaRemover);
    const tokenParaRemover = await obterToken(moradorParaRemover.email, moradorParaRemover.password);

    const casa2 = await criarCasaComAdmin(tokenAdmin, 'Casa Remoção 2');
    await entrarNaCasa(tokenParaRemover, casa2.invite_code);

    const idParaRemover = obterIdUsuario(moradorParaRemover.email);

    const resposta = await request(app)
      .delete(`/api/houses/${casa2.id}/members/${idParaRemover}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.be.oneOf([200, 204]);
  });

  it('membro removido não deve mais aparecer na lista da casa', async function () {
    const moradorTemp = { name: 'Temp Remove', email: 'temp.remove@test.com', password: 'senha123' };
    await registrarUsuario(moradorTemp);
    const tokenTemp = await obterToken(moradorTemp.email, moradorTemp.password);

    const casa3 = await criarCasaComAdmin(tokenAdmin, 'Casa Remoção 3');
    await entrarNaCasa(tokenTemp, casa3.invite_code);

    const idTemp = obterIdUsuario(moradorTemp.email);

    await request(app)
      .delete(`/api/houses/${casa3.id}/members/${idTemp}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const membros = await obterMembros(tokenAdmin, casa3.id);
    const removido = membros.find(m => m.user_id === idTemp);
    expect(removido).to.be.undefined;
  });

  // ─── ERRORS ──────────────────────────────────────────────────────────────────

  it('deve retornar 400 quando admin tenta remover a si mesmo', async function () {
    const adminId = obterIdUsuario('admin.remove@test.com');

    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/members/${adminId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(400);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 404 quando membro não existe na casa', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/members/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.status).to.equal(404);
    expect(resposta.body).to.have.property('error');
  });

  // ─── RESPONSIVENESS ──────────────────────────────────────────────────────────

  it('deve retornar Content-Type application/json em caso de erro', async function () {
    const resposta = await request(app)
      .delete(`/api/houses/${houseId}/members/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
