// Arquivo central de testes da API — POST endpoints
// Centraliza todos os casos de teste conforme exigido pela regra 4.11.5
// Heurística VADER aplicada em cada módulo: Verb | Authorization | Data | Errors | Responsiveness

require('./helpers/setup');

// ─── Autenticação ────────────────────────────────────────────────────────────
require('./post/auth.register.test');
require('./post/auth.login.test');

// ─── Casas ───────────────────────────────────────────────────────────────────
require('./post/houses.create.test');
require('./post/houses.join.test');

// ─── Membros ─────────────────────────────────────────────────────────────────
require('./post/members.invite.test');

// ─── Catálogo de Tarefas ─────────────────────────────────────────────────────
require('./post/catalog.create.test');
require('./post/catalog.dependencies.test');

// ─── Cronograma / Distribuição ───────────────────────────────────────────────
require('./post/schedule.distribute.test');
