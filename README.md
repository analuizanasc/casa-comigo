# Casa Comigo API

API REST para gestão colaborativa de tarefas domésticas. Distribui tarefas de forma inteligente entre moradores respeitando preferências, limitações físicas e pesos de esforço configuráveis.

## Stack

- **Runtime:** Node.js + Express
- **Banco de dados:** SQLite via `better-sqlite3`
- **Autenticação:** JWT (JSON Web Tokens)
- **Documentação:** Swagger UI (OpenAPI 3.0)

## Pré-requisitos

- Node.js 18+
- npm

## Instalação

```bash
npm install
```

## Configuração

```bash
cp .env.example .env
```

Edite o `.env`:

```
PORT=3000
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=7d
DATABASE_PATH=./data/casa-comigo.db
```

## Execução

```bash
# Produção
npm start

# Desenvolvimento (com hot reload)
npm run dev
```

A API estará disponível em `http://localhost:3000`.

A documentação Swagger estará em `http://localhost:3000/api/docs`.

## Arquitetura

```
src/
├── app.js                  # Ponto de entrada, configuração do Express e rotas
├── config/
│   └── database.js         # Conexão SQLite
├── models/
│   └── migrations.js       # Criação das tabelas (executado no startup)
├── middleware/
│   ├── auth.middleware.js   # Verificação de token JWT
│   └── roles.middleware.js  # Controle de acesso por papel (RN06)
├── routes/                 # Registro de rotas por domínio
├── controllers/            # Recebe requisição, valida input, chama service
└── services/               # Lógica de negócio e acesso ao banco
    ├── distribution.service.js  # Algoritmo de distribuição inteligente
    └── ...

resources/
└── swagger.yaml            # Documentação OpenAPI 3.0
```

## Autenticação

Todos os endpoints (exceto `/api/auth/register` e `/api/auth/login`) exigem o header:

```
Authorization: Bearer <token>
```

O token é obtido via `POST /api/auth/login`.

## Níveis de acesso (RN06)

| Papel | Quem atribui | Permissões |
|-------|-------------|------------|
| `admin` | Criador da casa | Acesso total |
| `catalog_manager` | Administrador | Gerencia catálogo + lê cronograma completo |
| `resident` | Padrão ao entrar | Vê/conclui suas tarefas + registra preferências |

## Endpoints

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastrar usuário |
| POST | `/api/auth/login` | Login e obtenção de token JWT |

### Casas
| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| POST | `/api/houses` | Autenticado | Criar casa (vira admin) |
| GET | `/api/houses/me` | Autenticado | Listar minhas casas |
| POST | `/api/houses/join` | Autenticado | Entrar via código de convite |
| GET | `/api/houses/:houseId` | Membro | Detalhes da casa |
| PATCH | `/api/houses/:houseId/tolerance` | Admin | Ajustar tolerância de balanceamento |

### Membros
| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/api/houses/:houseId/members` | Membro | Listar membros |
| POST | `/api/houses/:houseId/members/invite` | Admin | Convidar por e-mail |
| GET | `/api/houses/:houseId/members/weights` | Admin | Painel de pesos |
| PUT | `/api/houses/:houseId/members/:userId/role` | Admin | Alterar papel |
| PUT | `/api/houses/:houseId/members/:userId/weight` | Admin | Definir peso (%) |
| PUT | `/api/houses/:houseId/members/:userId/availability` | Membro | Atualizar disponibilidade |
| DELETE | `/api/houses/:houseId/members/:userId` | Admin | Remover membro |

### Catálogo de Tarefas
| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/api/houses/:houseId/catalog` | Membro | Listar tarefas |
| GET | `/api/houses/:houseId/catalog/:taskId` | Membro | Detalhe + dependências |
| POST | `/api/houses/:houseId/catalog` | Admin/Gestor | Criar tarefa |
| PUT | `/api/houses/:houseId/catalog/:taskId` | Admin/Gestor | Editar tarefa |
| DELETE | `/api/houses/:houseId/catalog/:taskId` | Admin/Gestor | Remover tarefa |
| POST | `/api/houses/:houseId/catalog/:taskId/dependencies` | Admin/Gestor | Adicionar dependência de ordem |
| DELETE | `/api/houses/:houseId/catalog/:taskId/dependencies/:dependsOnId` | Admin/Gestor | Remover dependência |

### Preferências
| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/api/houses/:houseId/preferences` | Membro | Minhas preferências |
| PUT | `/api/houses/:houseId/preferences/:taskId` | Membro | Definir preferência (hate/neutral/like) + limitação física |
| GET | `/api/houses/:houseId/preferences/member/:userId` | Admin | Preferências de outro membro |

### Cronograma / Distribuição
| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| POST | `/api/houses/:houseId/schedule/distribute` | Admin | Gerar distribuição automática |
| GET | `/api/houses/:houseId/schedule` | Membro | Consultar cronograma |
| GET | `/api/houses/:houseId/schedule/:assignmentId` | Membro | Detalhe de atribuição |
| PUT | `/api/houses/:houseId/schedule/:assignmentId/reassign` | Admin | Reatribuir manualmente |
| PATCH | `/api/houses/:houseId/schedule/:assignmentId/complete` | Membro | Marcar como concluída |
| PATCH | `/api/houses/:houseId/schedule/:assignmentId/impediment` | Membro | Reportar impedimento (redistribui automaticamente) |

### Relatórios
| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/api/houses/:houseId/reports/performance` | Admin | Desempenho por morador |
| GET | `/api/houses/:houseId/reports/balance` | Admin | Painel de balanceamento de esforço |

### Sistema
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check |
| GET | `/api/docs` | Swagger UI |

## Regras de negócio implementadas

| ID | Regra | Onde aplicada |
|----|-------|---------------|
| RN01 | Tarefas com dependência de ordem agendadas em sequência | `distribution.service.js` — topological sort + group_id |
| RN02 | Distribuição segue pesos %; desvio tolerado ±10pp (configurável) | `distribution.service.js` + `PATCH /tolerance` |
| RN03 | Limitação física nunca atribuída ao membro limitado | `distribution.service.js` + `schedule.service.js` |
| RN04 | Redistribuição não aumenta carga além do limite | `schedule.service.js` — seleciona membro com menor carga |
| RN05 | Sem responsável por mais de 2 dias (freq. semanal+) | Coberto pela distribuição contínua |
| RN06 | Três papéis de acesso | `roles.middleware.js` |
| RN07 | Aviso ao alterar pesos | `members.service.js` — retorna `warning` na resposta |

## Modelo de dados

```
users → house_members ← houses
task_catalog → task_dependencies (self-ref)
member_preferences (user × task)
task_assignments (task × user × date)
```

---

## Testes Automatizados de API

Testes de integração para os endpoints POST da API, implementados com **Mocha**, **Chai** e **Supertest**. Relatório HTML gerado via **Mochawesome**.

### Estrutura de testes

```
src/tests/api/
├── index.test.js              # Arquivo central — carrega todos os testes
├── helpers/
│   ├── setup.js               # Configura variáveis de ambiente de teste
│   ├── auth.helper.js         # Utilitários de autenticação (register, login, criar casa)
│   └── db.helper.js           # Limpeza do banco de dados de teste
├── fixtures/                  # Dados de teste (Data-Driven Testing)
│   ├── auth.register.fixture.js
│   ├── auth.login.fixture.js
│   ├── houses.create.fixture.js
│   ├── houses.join.fixture.js
│   ├── members.invite.fixture.js
│   ├── catalog.create.fixture.js
│   ├── catalog.dependencies.fixture.js
│   └── schedule.distribute.fixture.js
└── post/                      # Testes por endpoint POST
    ├── auth.register.test.js
    ├── auth.login.test.js
    ├── houses.create.test.js
    ├── houses.join.test.js
    ├── members.invite.test.js
    ├── catalog.create.test.js
    ├── catalog.dependencies.test.js
    └── schedule.distribute.test.js
```

### Execução dos testes

```bash
# Roda testes e gera relatório HTML em src/tests/api/reports/
npm run test:api

# Roda testes sem gerar relatório (saída no terminal)
npm run test:api:simples
```

O relatório HTML fica em `src/tests/api/reports/relatorio-api.html`.

### Heurística VADER

Cada endpoint é testado seguindo a heurística **VADER**:

| Letra | Significado | O que verifica |
|-------|-------------|----------------|
| **V** | Verb | Método HTTP correto (POST) |
| **A** | Authorization | Token obrigatório; papéis (admin, gestor, residente) |
| **D** | Data | Campos válidos, inválidos, obrigatórios e limites |
| **E** | Errors | Códigos HTTP corretos (400, 401, 403, 404, 409) |
| **R** | Responsiveness | Tempo de resposta, Content-Type, estrutura da resposta |

### Banco de dados de teste

Os testes usam um banco SQLite separado (`data/casa-comigo-test.db`) para não afetar os dados de desenvolvimento. O banco é limpo automaticamente antes de cada suíte.
