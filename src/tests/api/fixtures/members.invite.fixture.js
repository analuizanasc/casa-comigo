// Fixtures para POST /api/houses/:houseId/members/invite
// VADER: Verb | Authorization | Data | Errors | Responsiveness

const admin = {
  name: 'Admin Membros',
  email: 'admin.membros@test.com',
  password: 'senha123',
};

const morador = {
  name: 'Morador Comum',
  email: 'morador.comum@test.com',
  password: 'senha123',
};

const novoUsuario = {
  name: 'Novo Usuário',
  email: 'novo.usuario@test.com',
  password: 'senha123',
};

const casosInvalidos = [
  {
    descricao: 'deve retornar 400 quando email está ausente',
    corpo: {},
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 404 quando usuário com email informado não existe',
    corpo: { email: 'nao.existe.mesmo@test.com' },
    statusEsperado: 404,
    respostaEsperada: { temErro: true },
  },
];

const respostaEsperada = {
  camposObrigatorios: ['user_id', 'name', 'email', 'role'],
  papelPadrao: 'resident',
};

module.exports = { admin, morador, novoUsuario, casosInvalidos, respostaEsperada };
