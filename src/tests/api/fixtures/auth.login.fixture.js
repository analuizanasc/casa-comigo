// Fixtures para POST /api/auth/login
// VADER: Verb | Authorization | Data | Errors | Responsiveness

const usuarioPadrao = {
  name: 'Usuário Login',
  email: 'login@test.com',
  password: 'senha123',
};

const casosValidos = [
  {
    descricao: 'deve autenticar com credenciais válidas e retornar token JWT',
    corpo: { email: 'login@test.com', password: 'senha123' },
    statusEsperado: 200,
    respostaEsperada: {
      camposObrigatorios: ['token', 'user'],
      camposUsuario: ['id', 'name', 'email'],
    },
  },
];

const casosInvalidos = [
  {
    descricao: 'deve retornar 400 quando email está ausente',
    corpo: { password: 'senha123' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando senha está ausente',
    corpo: { email: 'login@test.com' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 401 com senha incorreta',
    corpo: { email: 'login@test.com', password: 'senhaErrada' },
    statusEsperado: 401,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 401 com email não cadastrado',
    corpo: { email: 'nao.existe@test.com', password: 'senha123' },
    statusEsperado: 401,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando corpo está completamente vazio',
    corpo: {},
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
];

module.exports = { usuarioPadrao, casosValidos, casosInvalidos };
