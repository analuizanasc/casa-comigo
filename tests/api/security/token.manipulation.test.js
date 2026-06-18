require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin } = require('../helpers/auth.helper');
const fixture = require('../fixtures/security/data');

describe('Segurança — Manipulação de Token JWT', function () {
  this.timeout(5000);

  let houseId;
  const ENDPOINT_PROTEGIDO = () => `/api/houses/${houseId}/members`;

  before(async function () {
    limparBancoDados();
    await registrarUsuario(fixture.casaA.admin);
    const token = await obterToken(fixture.casaA.admin.email, fixture.casaA.admin.password);
    const casa = await criarCasaComAdmin(token, fixture.casaA.nomeCasa);
    houseId = casa.id;
  });

  // ─── AUSÊNCIA DE TOKEN ────────────────────────────────────────────────────────

  it('deve retornar 401 quando nenhum token é enviado', async function () {
    const resposta = await request(app).get(ENDPOINT_PROTEGIDO());
    expect(resposta.status).to.equal(401);
    expect(resposta.body).to.have.property('error');
  });

  it('deve retornar 401 quando Authorization header está vazio', async function () {
    const resposta = await request(app)
      .get(ENDPOINT_PROTEGIDO())
      .set('Authorization', '');
    expect(resposta.status).to.equal(401);
  });

  // ─── TOKEN MAL FORMADO ────────────────────────────────────────────────────────

  it('deve retornar 401 para token com apenas uma parte (sem pontos)', async function () {
    const resposta = await request(app)
      .get(ENDPOINT_PROTEGIDO())
      .set('Authorization', 'Bearer tokeninvalido');
    expect(resposta.status).to.equal(401);
  });

  it('deve retornar 401 para token com apenas duas partes', async function () {
    const resposta = await request(app)
      .get(ENDPOINT_PROTEGIDO())
      .set('Authorization', 'Bearer header.payload');
    expect(resposta.status).to.equal(401);
  });

  it('deve retornar 401 para token com partes corretas porém conteúdo inválido (base64 corrompido)', async function () {
    const resposta = await request(app)
      .get(ENDPOINT_PROTEGIDO())
      .set('Authorization', 'Bearer aaa.bbb.ccc');
    expect(resposta.status).to.equal(401);
  });

  // ─── ASSINATURA ALTERADA ──────────────────────────────────────────────────────

  it('deve retornar 401 quando a assinatura do token é alterada', async function () {
    const token = await obterToken(fixture.casaA.admin.email, fixture.casaA.admin.password);
    const partes = token.split('.');
    const tokenAlterado = `${partes[0]}.${partes[1]}.assinatura_falsa`;

    const resposta = await request(app)
      .get(ENDPOINT_PROTEGIDO())
      .set('Authorization', `Bearer ${tokenAlterado}`);
    expect(resposta.status).to.equal(401);
  });

  it('deve retornar 401 quando o payload do token é alterado mantendo assinatura original', async function () {
    const token = await obterToken(fixture.casaA.admin.email, fixture.casaA.admin.password);
    const partes = token.split('.');

    // Altera o payload: substitui id por um UUID fictício
    const payloadFalso = Buffer.from(JSON.stringify({ id: '00000000-0000-0000-0000-000000000000', email: 'fake@test.com' })).toString('base64url');
    const tokenAlterado = `${partes[0]}.${payloadFalso}.${partes[2]}`;

    const resposta = await request(app)
      .get(ENDPOINT_PROTEGIDO())
      .set('Authorization', `Bearer ${tokenAlterado}`);
    expect(resposta.status).to.equal(401);
  });

  // ─── ESQUEMA BEARER ───────────────────────────────────────────────────────────

  it('deve retornar 401 quando token válido é enviado sem prefixo Bearer', async function () {
    const token = await obterToken(fixture.casaA.admin.email, fixture.casaA.admin.password);
    const resposta = await request(app)
      .get(ENDPOINT_PROTEGIDO())
      .set('Authorization', token);
    expect(resposta.status).to.equal(401);
  });

  it('deve retornar 401 com prefixo errado (Basic ao invés de Bearer)', async function () {
    const token = await obterToken(fixture.casaA.admin.email, fixture.casaA.admin.password);
    const resposta = await request(app)
      .get(ENDPOINT_PROTEGIDO())
      .set('Authorization', `Basic ${token}`);
    expect(resposta.status).to.equal(401);
  });

  // ─── INJEÇÃO VIA ROTA ─────────────────────────────────────────────────────────

  it('deve retornar 404 ou 403 para houseId com UUID inexistente (bem formado)', async function () {
    const token = await obterToken(fixture.casaA.admin.email, fixture.casaA.admin.password);
    const resposta = await request(app)
      .get('/api/houses/00000000-0000-0000-0000-000000000000/members')
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status).to.be.oneOf([403, 404]);
  });

  it('deve retornar 400, 403 ou 404 para houseId com valor não-UUID (injeção de path)', async function () {
    const token = await obterToken(fixture.casaA.admin.email, fixture.casaA.admin.password);
    const resposta = await request(app)
      .get('/api/houses/../users/members')
      .set('Authorization', `Bearer ${token}`);
    expect(resposta.status).to.be.oneOf([400, 403, 404]);
  });

  it('deve retornar Content-Type application/json em todos os erros de token', async function () {
    const resposta = await request(app)
      .get(ENDPOINT_PROTEGIDO())
      .set('Authorization', 'Bearer token.invalido.aqui');
    expect(resposta.status).to.equal(401);
    expect(resposta.headers['content-type']).to.match(/application\/json/);
  });
});
