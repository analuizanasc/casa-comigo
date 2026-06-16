require('./helpers/setup');

// ─── Autenticação ─────────────────────────────────────────────────────────────
require('./auth/auth.register.test');
require('./auth/auth.login.test');

// ─── Casas ────────────────────────────────────────────────────────────────────
require('./houses/houses.create.test');
require('./houses/houses.join.test');
require('./houses/houses.me.test');
require('./houses/houses.detail.test');
require('./houses/houses.tolerance.test');

// ─── Membros ──────────────────────────────────────────────────────────────────
require('./members/members.invite.test');
require('./members/members.list.test');
require('./members/members.weights.test');
require('./members/members.role.test');
require('./members/members.weight.test');
require('./members/members.availability.test');
require('./members/members.remove.test');

// ─── Catálogo de Tarefas ──────────────────────────────────────────────────────
require('./catalog/catalog.create.test');
require('./catalog/catalog.dependencies.test');
require('./catalog/catalog.list.test');
require('./catalog/catalog.detail.test');
require('./catalog/catalog.update.test');
require('./catalog/catalog.task.delete.test');
require('./catalog/catalog.dependency.delete.test');

// ─── Preferências ─────────────────────────────────────────────────────────────
require('./preferences/preferences.list.test');
require('./preferences/preferences.member.test');
require('./preferences/preferences.upsert.test');

// ─── Cronograma / Distribuição ────────────────────────────────────────────────
require('./schedule/schedule.distribute.test');
require('./schedule/schedule.list.test');
require('./schedule/schedule.detail.test');
require('./schedule/schedule.reassign.test');
require('./schedule/schedule.complete.test');
require('./schedule/schedule.impediment.test');

// ─── Relatórios ───────────────────────────────────────────────────────────────
require('./reports/reports.performance.test');
require('./reports/reports.balance.test');

// ─── Notificações e Convites ──────────────────────────────────────────────────
require('./notifications/notifications.test');
require('./notifications/invitations.test');
require('./notifications/health.test');

// ─── Segurança ────────────────────────────────────────────────────────────────
require('./security/token.manipulation.test');
require('./security/cross-house.test');

// ─── Regras de Negócio ────────────────────────────────────────────────────────
require('./business-rules/roles.decision-table.test');
require('./business-rules/rn02.tolerance.bva.test');
require('./business-rules/status-transitions.test');
