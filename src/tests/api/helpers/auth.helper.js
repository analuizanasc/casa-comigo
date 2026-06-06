require('./setup');
const request = require('supertest');
const app = require('../../../app');

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

async function criarTarefa(tokenAdmin, houseId, dadosTarefa) {
  const resposta = await request(app)
    .post(`/api/houses/${houseId}/catalog`)
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send(dadosTarefa);
  return resposta.body;
}

module.exports = { registrarUsuario, obterToken, criarCasaComAdmin, criarTarefa };
