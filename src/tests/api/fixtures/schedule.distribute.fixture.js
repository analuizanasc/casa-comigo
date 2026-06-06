// Fixtures para POST /api/houses/:houseId/schedule/distribute
// VADER: Verb | Authorization | Data | Errors | Responsiveness
// RN02: Distribuição segue pesos por morador | RN03: Limitação física nunca atribuída

const admin = {
  name: 'Admin Distribuição',
  email: 'admin.distrib@test.com',
  password: 'senha123',
};

const moradorA = {
  name: 'Morador Alfa',
  email: 'morador.alfa@test.com',
  password: 'senha123',
};

const moradorB = {
  name: 'Morador Beta',
  email: 'morador.beta@test.com',
  password: 'senha123',
};

const tarefas = [
  { name: 'Limpar banheiro', frequency: 'weekly', effort_level: 'heavy', room: 'Banheiro' },
  { name: 'Varrer sala', frequency: 'weekly', effort_level: 'light', room: 'Sala' },
  { name: 'Lavar louça', frequency: 'daily', effort_level: 'medium', room: 'Cozinha' },
];

const casosValidos = [
  {
    descricao: 'deve gerar distribuição com período de uma semana',
    corpo: {
      period_start: '2025-07-01',
      period_end: '2025-07-07',
    },
    statusEsperado: 201,
    respostaEsperada: {
      camposObrigatorios: ['period_start', 'period_end', 'total_tasks_assigned', 'within_tolerance', 'balance'],
    },
  },
  {
    descricao: 'deve gerar distribuição com rótulo de período personalizado',
    corpo: {
      period_start: '2025-07-01',
      period_end: '2025-07-31',
      period_label: 'julho-2025',
    },
    statusEsperado: 201,
    respostaEsperada: {
      camposObrigatorios: ['period_start', 'period_end', 'total_tasks_assigned', 'balance'],
    },
  },
];

const casosInvalidos = [
  {
    descricao: 'deve retornar 400 quando period_start está ausente',
    corpo: { period_end: '2025-07-31' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando period_end está ausente',
    corpo: { period_start: '2025-07-01' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando period_start é posterior a period_end',
    corpo: { period_start: '2025-07-31', period_end: '2025-07-01' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando corpo está vazio',
    corpo: {},
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
];

module.exports = { admin, moradorA, moradorB, tarefas, casosValidos, casosInvalidos };
