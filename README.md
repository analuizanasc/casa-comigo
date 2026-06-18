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

## Modelo de dados

```
users → house_members ← houses
task_catalog → task_dependencies (self-ref)
member_preferences (user × task)
task_assignments (task × user × date)
```

---

## Testes Automatizados de API

Testes de integração para os endpoints da API, implementados com **Mocha**, **Chai** e **Supertest**. Relatório HTML gerado via **Mochawesome**.



### Execução dos testes

```bash
# Roda testes e gera relatório HTML em src/tests/api/reports/
npm run test:api

# Roda testes sem gerar relatório (saída no terminal)
npm run test:api:simples
```

O relatório HTML fica em `src/tests/api/reports/relatorio-api.html`.

---

## Integração Contínua (CI)

A pipeline de CI é implementada com **GitHub Actions** e está definida em [`.github/workflows/ci.yaml`](.github/workflows/ci.yaml).

### Gatilhos

A pipeline é acionada em três situações:

| Gatilho | Quando dispara |
|---------|---------------|
| `push` | A cada push nas branches `main` ou `develop` |
| `schedule` | Automaticamente de segunda a sexta, às 9h BRT (12h UTC), via expressão cron |
| `workflow_dispatch` | Manualmente pelo painel do GitHub Actions |

O agendamento por `schedule` usa a sintaxe **cron** do Unix: `0 12 * * 1-5` — onde os campos representam, da esquerda para a direita, minuto, hora, dia do mês, mês e dia da semana (1 = segunda, 5 = sexta).

### Jobs e sequência de execução

A pipeline é dividida em três **jobs** com dependências explícitas, formando um fluxo sequencial de qualidade:

```
validacoes-estaticas
        │
        ▼
testes-de-unidade-e-integracao
        │
        ▼
      deploy
```

A dependência é declarada com `needs`, que garante que um job só inicia se o anterior passou com sucesso. Isso evita rodar testes em código que nem compila, e impede deploys de código não validado.

Todos os jobs rodam em `ubuntu-latest`, um ambiente Linux efêmero provisionado pelo GitHub a cada execução.

#### Job 1 — `validacoes-estaticas`

Realiza verificações rápidas que não precisam do banco de dados:

1. **Checkout** (`actions/checkout@v4`) — clona o repositório no runner.
2. **Setup Node** (`actions/setup-node@v4`) — instala o Node.js 20.
3. **`npm ci`** — instala dependências de forma determinística a partir do `package-lock.json`, sem alterar o lockfile. Preferido ao `npm install` em CI por ser mais rápido e previsível.
4. **Lint** — valida estilo e padrões de código.

#### Job 2 — `testes-de-unidade-e-integracao`

Roda após as validações estáticas e executa a suíte completa de testes:

1. Repete checkout + setup + `npm ci` (cada job recebe um runner limpo e isolado).
2. **Testes unitários** (`npm test`) — Jest com banco mockado.
3. **Testes de integração** (`npm run test:api`) — Mocha + Supertest contra o banco SQLite de teste.
4. **Upload de artefato** (`actions/upload-artifact@v4`) — salva o relatório HTML do Mochawesome para download no painel do GitHub, mesmo que os testes tenham falhado (`if: always()`).

> **`if: always()`** garante que o relatório seja salvo independentemente do resultado dos testes, o que é essencial para análise de falhas em CI.

#### Job 3 — `deploy`

Representa a etapa de entrega contínua. Só executa se os dois jobs anteriores foram aprovados (`needs: [validacoes-estaticas, testes-de-unidade-e-integracao]`). Atualmente simula o deploy com um `echo`; a integração real com o ambiente de produção pode ser adicionada neste job.

### Artefatos

O relatório de testes gerado pelo Mochawesome fica disponível para download diretamente na aba **Actions** do GitHub, na execução correspondente, por 90 dias (retenção padrão do GitHub).

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
