const db = require('../config/database');

function requireHouseMember(req, res, next) {
  const { houseId } = req.params;
  const member = db.prepare(
    'SELECT * FROM house_members WHERE house_id = ? AND user_id = ?'
  ).get(houseId, req.user.id);

  if (!member) {
    return res.status(403).json({ error: 'Acesso negado. Você não é membro desta casa.' });
  }

  req.member = member;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.member || req.member.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
  }
  next();
}

function requireAdminOrCatalogManager(req, res, next) {
  if (!req.member || !['admin', 'catalog_manager'].includes(req.member.role)) {
    return res.status(403).json({ error: 'Acesso negado. Requer permissão de administrador ou gestor de catálogo.' });
  }
  next();
}

module.exports = { requireHouseMember, requireAdmin, requireAdminOrCatalogManager };
