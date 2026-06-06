// Fixtures para POST /api/houses
// VADER: Verb | Authorization | Data | Errors | Responsiveness

const usuarioPadrao = {
  name: 'Admin Criador',
  email: 'admin.criar.casa@test.com',
  password: 'senha123',
};

const casosValidos = [
  {
    descricao: 'deve criar casa com nome válido',
    corpo: { name: 'Apartamento 42' },
    statusEsperado: 201,
    respostaEsperada: {
      camposObrigatorios: ['id', 'name', 'invite_code', 'tolerance_percentage'],
    },
  },
  {
    descricao: 'deve criar casa com nome que contém espaços e acentos',
    corpo: { name: 'Casa dos Moradores da Rua' },
    statusEsperado: 201,
    respostaEsperada: {
      camposObrigatorios: ['id', 'name', 'invite_code'],
    },
  },
];

const casosInvalidos = [
  {
    descricao: 'deve retornar 400 quando nome está ausente',
    corpo: {},
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando nome está vazio',
    corpo: { name: '' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando nome contém apenas espaços',
    corpo: { name: '   ' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
];

const toleranciaDefault = 10;

module.exports = { usuarioPadrao, casosValidos, casosInvalidos, toleranciaDefault };
