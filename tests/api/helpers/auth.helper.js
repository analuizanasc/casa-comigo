require('./setup');
const request = require('supertest');
const app = require('../../../src/app');

async function registrarUsuario(dados) {
  const resposta = await request(app).post('/api/auth/register').send(dados);
  return resposta.body;
}

async function obterToken(email, senha) {
  const resposta = await request(app)
    .post('/api/auth/login')
    .send({ email, password: senha });
  return resposta.body.token;
}

async function criarCasaComAdmin(tokenAdmin, nomeCasa) {
  const resposta = await request(app)
    .post('/api/houses')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ name: nomeCasa });
  return resposta.body;
}

async function entrarNaCasa(token, inviteCode) {
  const resposta = await request(app)
    .post('/api/houses/join')
    .set('Authorization', `Bearer ${token}`)
    .send({ invite_code: inviteCode });
  return resposta.body;
}

async function criarTarefa(tokenAdmin, houseId, dadosTarefa) {
  const resposta = await request(app)
    .post(`/api/houses/${houseId}/catalog`)
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send(dadosTarefa);
  return resposta.body;
}

async function atualizarPapel(tokenAdmin, houseId, userId, role) {
  await request(app)
    .put(`/api/houses/${houseId}/members/${userId}/role`)
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ role });
}

async function obterMembros(tokenAdmin, houseId) {
  const resposta = await request(app)
    .get(`/api/houses/${houseId}/members`)
    .set('Authorization', `Bearer ${tokenAdmin}`);
  return resposta.body;
}

async function distribuirTarefas(tokenAdmin, houseId, periodStart, periodEnd) {
  const resposta = await request(app)
    .post(`/api/houses/${houseId}/schedule/distribute`)
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ period_start: periodStart, period_end: periodEnd });
  return resposta.body;
}

async function obterCronograma(token, houseId, query = {}) {
  const resposta = await request(app)
    .get(`/api/houses/${houseId}/schedule`)
    .set('Authorization', `Bearer ${token}`)
    .query(query);
  return resposta.body;
}

module.exports = {
  registrarUsuario,
  obterToken,
  criarCasaComAdmin,
  entrarNaCasa,
  criarTarefa,
  atualizarPapel,
  obterMembros,
  distribuirTarefas,
  obterCronograma,
};
