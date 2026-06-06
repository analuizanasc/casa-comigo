// Fixtures para POST /api/houses/:houseId/catalog/:taskId/dependencies
// VADER: Verb | Authorization | Data | Errors | Responsiveness
// RN01: Tarefas com dependência de ordem agendadas em sequência

const admin = {
  name: 'Admin Dependências',
  email: 'admin.dep@test.com',
  password: 'senha123',
};

const morador = {
  name: 'Morador Dependências',
  email: 'morador.dep@test.com',
  password: 'senha123',
};

const tarefaA = {
  name: 'Espanar móveis',
  frequency: 'weekly',
  effort_level: 'light',
  room: 'Sala',
};

const tarefaB = {
  name: 'Varrer a sala',
  frequency: 'weekly',
  effort_level: 'light',
  room: 'Sala',
};

const tarefaC = {
  name: 'Passar pano no chão',
  frequency: 'weekly',
  effort_level: 'medium',
  room: 'Sala',
};

const casosInvalidos = [
  {
    descricao: 'deve retornar 400 quando depends_on_task_id está ausente (RN01)',
    corpo: {},
    statusEsperado: 400,
    respostaEsperada: { temErro: true },
  },
];

const respostaEsperada = {
  camposObrigatorios: ['message'],
};

module.exports = { admin, morador, tarefaA, tarefaB, tarefaC, casosInvalidos, respostaEsperada };
