require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin } = require('../helpers/auth.helper');
const fixture = require('../fixtures/notifications/invitations');

describe('Convites In-App — GET, POST accept/reject (EP01-US01 / RN08)', function () {
  this.timeout(10000);

  let tokenAdmin;
  let tokenConvidado;
  let houseId;
  let invitationId;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.convidado);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenConvidado = await obterToken(fixture.convidado.email, fixture.convidado.password);

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);
    houseId = casa.id;

    const conviteResp = await request(app)
      .post(`/api/houses/${houseId}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: fixture.convidado.email });

    invitationId = conviteResp.body.invitation_id;
  });

  // ─── GET /api/invitations ────────────────────────────────────────────────────

  describe('GET /api/invitations — Listar Convites Pendentes', function () {
    it('deve aceitar requisições com método GET', async function () {
      const resposta = await request(app)
        .get('/api/invitations')
        .set('Authorization', `Bearer ${tokenConvidado}`);

      expect(resposta.status).to.not.equal(405);
    });

    it('deve retornar 401 quando token de autorização está ausente', async function () {
      const resposta = await request(app).get('/api/invitations');

      expect(resposta.status).to.equal(401);
      expect(resposta.body).to.have.property('error');
    });

    it('deve retornar lista de convites pendentes do usuário', async function () {
      const resposta = await request(app)
        .get('/api/invitations')
        .set('Authorization', `Bearer ${tokenConvidado}`);

      expect(resposta.status).to.equal(200);
      expect(resposta.body).to.be.an('array').with.length.above(0);
    });

    it('deve retornar campos obrigatórios em cada convite', async function () {
      const resposta = await request(app)
        .get('/api/invitations')
        .set('Authorization', `Bearer ${tokenConvidado}`);

      expect(resposta.status).to.equal(200);
      const convite = resposta.body[0];
      ['id', 'house_id', 'house_name', 'invited_by_name', 'status', 'created_at'].forEach(campo => {
        expect(convite).to.have.property(campo);
      });
    });

    it('deve retornar convites com status pending (RN08)', async function () {
      const resposta = await request(app)
        .get('/api/invitations')
        .set('Authorization', `Bearer ${tokenConvidado}`);

      expect(resposta.status).to.equal(200);
      resposta.body.forEach(c => expect(c.status).to.equal('pending'));
    });

    it('admin que enviou convite não deve ter convites na própria lista', async function () {
      const resposta = await request(app)
        .get('/api/invitations')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(resposta.status).to.equal(200);
      expect(resposta.body).to.be.an('array').that.is.empty;
    });
  });

  // ─── POST /api/invitations/:id/reject ───────────────────────────────────────

  describe('POST /api/invitations/:id/reject — Recusar Convite (RN08)', function () {
    it('deve aceitar requisições com método POST', async function () {
      const resposta = await request(app)
        .post(`/api/invitations/${invitationId}/reject`)
        .set('Authorization', `Bearer ${tokenConvidado}`);

      expect(resposta.status).to.not.equal(405);
    });

    it('deve retornar 401 quando token de autorização está ausente', async function () {
      const resposta = await request(app).post(`/api/invitations/${invitationId}/reject`);

      expect(resposta.status).to.equal(401);
      expect(resposta.body).to.have.property('error');
    });

    it('deve recusar convite pendente e retornar mensagem', async function () {
      const novoConvidado = { name: 'Convidado Reject', email: 'convidado.reject@test.com', password: 'senha123' };
      await registrarUsuario(novoConvidado);
      const tokenNovo = await obterToken(novoConvidado.email, novoConvidado.password);

      const conviteResp = await request(app)
        .post(`/api/houses/${houseId}/members/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ email: novoConvidado.email });

      const idConvite = conviteResp.body.invitation_id;

      const resposta = await request(app)
        .post(`/api/invitations/${idConvite}/reject`)
        .set('Authorization', `Bearer ${tokenNovo}`);

      expect(resposta.status).to.equal(200);
      expect(resposta.body).to.have.property('message');
    });

    it('deve retornar 404 quando convite não existe ou já foi processado (RN08)', async function () {
      const resposta = await request(app)
        .post('/api/invitations/00000000-0000-0000-0000-000000000000/reject')
        .set('Authorization', `Bearer ${tokenConvidado}`);

      expect(resposta.status).to.equal(404);
      expect(resposta.body).to.have.property('error');
    });
  });

  // ─── POST /api/invitations/:id/accept ───────────────────────────────────────

  describe('POST /api/invitations/:id/accept — Aceitar Convite (RN08)', function () {
    let tokenParaAceite;
    let idParaAceite;

    before(async function () {
      const aceitaData = { name: 'Convidado Aceite', email: 'convidado.aceite@test.com', password: 'senha123' };
      await registrarUsuario(aceitaData);
      tokenParaAceite = await obterToken(aceitaData.email, aceitaData.password);

      const conviteResp = await request(app)
        .post(`/api/houses/${houseId}/members/invite`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ email: aceitaData.email });

      idParaAceite = conviteResp.body.invitation_id;
    });

    it('deve aceitar convite pendente e retornar dados da casa', async function () {
      const resposta = await request(app)
        .post(`/api/invitations/${idParaAceite}/accept`)
        .set('Authorization', `Bearer ${tokenParaAceite}`);

      expect(resposta.status).to.equal(200);
      expect(resposta.body).to.have.property('house_id', houseId);
      expect(resposta.body).to.have.property('role', 'resident');
    });

    it('deve retornar 401 quando token de autorização está ausente', async function () {
      const resposta = await request(app).post(`/api/invitations/${idParaAceite}/accept`);

      expect(resposta.status).to.equal(401);
      expect(resposta.body).to.have.property('error');
    });

    it('deve retornar 404 ao aceitar convite já processado (RN08)', async function () {
      const resposta = await request(app)
        .post(`/api/invitations/${idParaAceite}/accept`)
        .set('Authorization', `Bearer ${tokenParaAceite}`);

      expect(resposta.status).to.be.oneOf([404, 409]);
      expect(resposta.body).to.have.property('error');
    });

    it('deve retornar Content-Type application/json', async function () {
      const resposta = await request(app)
        .post('/api/invitations/00000000-0000-0000-0000-000000000000/accept')
        .set('Authorization', `Bearer ${tokenParaAceite}`);

      expect(resposta.headers['content-type']).to.match(/application\/json/);
    });
  });
});
