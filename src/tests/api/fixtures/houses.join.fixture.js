// Fixtures para POST /api/houses/join
// VADER: Verb | Authorization | Data | Errors | Responsiveness

const admin = {
  name: 'Admin Convite',
  email: 'admin.join@test.com',
  password: 'senha123',
};

const novoMembro = {
  name: 'Novo Morador',
  email: 'novo.morador@test.com',
  password: 'senha123',
};

const casosInvalidos = [
  {
    descricao: 'deve retornar 400 quando código de convite está ausente',
    corpo: {},
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 404 com código de convite inexistente',
    corpo: { invite_code: 'INVALIDO' },
    statusEsperado: 404,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 404 com código de convite malformado',
    corpo: { invite_code: '!!!###' },
    statusEsperado: 404,
    respostaEsperada: { temErro: true },
  },
];

const respostaEsperada = {
  camposObrigatorios: ['id', 'name', 'tolerance_percentage'],
};

module.exports = { admin, novoMembro, casosInvalidos, respostaEsperada };
