// Fixtures para POST /api/auth/register
// VADER: Verb | Authorization | Data | Errors | Responsiveness

const casosValidos = [
  {
    descricao: 'deve registrar usuário com todos os campos válidos',
    corpo: { name: 'Ana Luiza', email: 'ana.luiza@test.com', password: 'senha123' },
    statusEsperado: 201,
    respostaEsperada: {
      camposObrigatorios: ['message', 'user'],
      camposUsuario: ['id', 'name', 'email'],
    },
  },
  {
    descricao: 'deve registrar usuário com senha exatamente no limite mínimo (6 caracteres)',
    corpo: { name: 'Carlos Silva', email: 'carlos@test.com', password: 'abc123' },
    statusEsperado: 201,
    respostaEsperada: {
      camposObrigatorios: ['message', 'user'],
    },
  },
];

const casosInvalidos = [
  {
    descricao: 'deve retornar 400 quando nome está ausente',
    corpo: { email: 'sem.nome@test.com', password: 'senha123' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando email está ausente',
    corpo: { name: 'Sem Email', password: 'senha123' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando senha está ausente',
    corpo: { name: 'Sem Senha', email: 'sem.senha@test.com' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando senha tem menos de 6 caracteres',
    corpo: { name: 'Senha Curta', email: 'senha.curta@test.com', password: '12345' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando corpo está completamente vazio',
    corpo: {},
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
];

const usuarioBase = {
  name: 'Usuário Base Registro',
  email: 'base.registro@test.com',
  password: 'senha123',
};

module.exports = { casosValidos, casosInvalidos, usuarioBase };
