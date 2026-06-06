// Fixtures para POST /api/houses/:houseId/catalog
// VADER: Verb | Authorization | Data | Errors | Responsiveness

const admin = {
  name: 'Admin Catálogo',
  email: 'admin.catalogo@test.com',
  password: 'senha123',
};

const gestorCatalogo = {
  name: 'Gestor Catálogo',
  email: 'gestor.catalogo@test.com',
  password: 'senha123',
};

const morador = {
  name: 'Morador Catálogo',
  email: 'morador.catalogo@test.com',
  password: 'senha123',
};

const casosValidos = [
  {
    descricao: 'deve criar tarefa com campos mínimos obrigatórios',
    corpo: {
      name: 'Varrer a sala',
      frequency: 'weekly',
      effort_level: 'light',
    },
    statusEsperado: 201,
    respostaEsperada: {
      camposObrigatorios: ['id', 'name', 'frequency', 'effort_level', 'is_active', 'dependencies', 'dependents'],
      duracaoPadrao: 30,
    },
  },
  {
    descricao: 'deve criar tarefa com todos os campos preenchidos',
    corpo: {
      name: 'Lavar louça',
      description: 'Lavar toda a louça acumulada na pia',
      frequency: 'daily',
      duration_minutes: 20,
      effort_level: 'medium',
      room: 'Cozinha',
    },
    statusEsperado: 201,
    respostaEsperada: {
      camposObrigatorios: ['id', 'name', 'frequency', 'effort_level', 'room'],
    },
  },
];

const frequenciasValidas = [
  { descricao: 'deve criar tarefa com frequência diária', frequency: 'daily' },
  { descricao: 'deve criar tarefa com frequência semanal', frequency: 'weekly' },
  { descricao: 'deve criar tarefa com frequência quinzenal', frequency: 'biweekly' },
  { descricao: 'deve criar tarefa com frequência mensal', frequency: 'monthly' },
  { descricao: 'deve criar tarefa com frequência trimestral', frequency: 'quarterly' },
  { descricao: 'deve criar tarefa com frequência anual', frequency: 'annual' },
];

const esforcoValido = [
  { descricao: 'deve criar tarefa com esforço leve', effort_level: 'light' },
  { descricao: 'deve criar tarefa com esforço médio', effort_level: 'medium' },
  { descricao: 'deve criar tarefa com esforço pesado', effort_level: 'heavy' },
];

const casosInvalidos = [
  {
    descricao: 'deve retornar 400 quando nome está ausente',
    corpo: { frequency: 'weekly', effort_level: 'light' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando frequência está ausente',
    corpo: { name: 'Tarefa sem frequência', effort_level: 'light' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 quando nível de esforço está ausente',
    corpo: { name: 'Tarefa sem esforço', frequency: 'weekly' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 com frequência inválida',
    corpo: { name: 'Tarefa freq inválida', frequency: 'invalida', effort_level: 'light' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 com nível de esforço inválido',
    corpo: { name: 'Tarefa esforço inválido', frequency: 'weekly', effort_level: 'extremo' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
  {
    descricao: 'deve retornar 400 com nome vazio',
    corpo: { name: '', frequency: 'weekly', effort_level: 'light' },
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
];

const tarefaBase = {
  name: 'Tarefa Base Catálogo',
  frequency: 'weekly',
  effort_level: 'light',
};

module.exports = {
  admin,
  gestorCatalogo,
  morador,
  casosValidos,
  casosInvalidos,
  frequenciasValidas,
  esforcoValido,
  tarefaBase,
};
