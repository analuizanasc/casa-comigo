require('../helpers/setup');
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../../src/app');
const { limparBancoDados } = require('../helpers/db.helper');
const { registrarUsuario, obterToken, criarCasaComAdmin } = require('../helpers/auth.helper');
const fixture = require('../fixtures/notifications/notifications');

describe('Notificações In-App — GET, PATCH (EP06)', function () {
  this.timeout(10000);

  let tokenAdmin;
  let tokenMorador;
  let moradorEmail;

  before(async function () {
    limparBancoDados();

    await registrarUsuario(fixture.admin);
    await registrarUsuario(fixture.morador);

    tokenAdmin = await obterToken(fixture.admin.email, fixture.admin.password);
    tokenMorador = await obterToken(fixture.morador.email, fixture.morador.password);
    moradorEmail = fixture.morador.email;

    const casa = await criarCasaComAdmin(tokenAdmin, fixture.nomeCasa);

    await request(app)
      .post(`/api/houses/${casa.id}/members/invite`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ email: moradorEmail });
  });

  // ─── GET /api/notifications ──────────────────────────────────────────────────

  describe('GET /api/notifications — Listar Notificações', function () {
    it('deve aceitar requisições com método GET', async function () {
      const resposta = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.status).to.not.equal(405);
    });

    it('deve retornar 401 quando token de autorização está ausente', async function () {
      const resposta = await request(app).get('/api/notifications');

      expect(resposta.status).to.equal(401);
      expect(resposta.body).to.have.property('error');
    });

    it('deve retornar lista de notificações do usuário autenticado', async function () {
      const resposta = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.status).to.equal(200);
      expect(resposta.body).to.be.an('array');
    });

    it('deve retornar notificação do tipo house_invitation para morador convidado', async function () {
      const resposta = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.status).to.equal(200);
      const notif = resposta.body.find(n => n.type === 'house_invitation');
      expect(notif).to.exist;
    });

    it('deve retornar campos obrigatórios em cada notificação', async function () {
      const resposta = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.status).to.equal(200);
      if (resposta.body.length > 0) {
        const notif = resposta.body[0];
        ['id', 'type', 'title', 'body', 'is_read', 'created_at'].forEach(campo => {
          expect(notif).to.have.property(campo);
        });
      }
    });

    it('deve retornar Content-Type application/json', async function () {
      const resposta = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.headers['content-type']).to.match(/application\/json/);
    });
  });

  // ─── PATCH /api/notifications/:id/read ───────────────────────────────────────

  describe('PATCH /api/notifications/:id/read — Marcar Notificação como Lida', function () {
    let notificacaoId;

    before(async function () {
      const resposta = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenMorador}`);
      notificacaoId = resposta.body[0]?.id;
    });

    it('deve aceitar requisições com método PATCH', async function () {
      if (!notificacaoId) return this.skip();

      const resposta = await request(app)
        .patch(`/api/notifications/${notificacaoId}/read`)
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.status).to.not.equal(405);
    });

    it('deve retornar 401 quando token de autorização está ausente', async function () {
      const resposta = await request(app).patch('/api/notifications/qualquer-id/read');

      expect(resposta.status).to.equal(401);
      expect(resposta.body).to.have.property('error');
    });

    it('deve marcar notificação como lida e retornar mensagem de confirmação', async function () {
      if (!notificacaoId) return this.skip();

      const resposta = await request(app)
        .patch(`/api/notifications/${notificacaoId}/read`)
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.status).to.equal(200);
      expect(resposta.body).to.have.property('message');
    });

    it('deve retornar 404 quando notificação não pertence ao usuário', async function () {
      const resposta = await request(app)
        .patch('/api/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.status).to.equal(404);
      expect(resposta.body).to.have.property('error');
    });
  });

  // ─── PATCH /api/notifications/read-all ───────────────────────────────────────

  describe('PATCH /api/notifications/read-all — Marcar Todas como Lidas', function () {
    it('deve aceitar requisições com método PATCH', async function () {
      const resposta = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.status).to.not.equal(405);
    });

    it('deve retornar 401 quando token de autorização está ausente', async function () {
      const resposta = await request(app).patch('/api/notifications/read-all');

      expect(resposta.status).to.equal(401);
      expect(resposta.body).to.have.property('error');
    });

    it('deve marcar todas as notificações do usuário como lidas', async function () {
      const resposta = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${tokenMorador}`);

      expect(resposta.status).to.equal(200);
      expect(resposta.body).to.have.property('message');
    });

  });
});
