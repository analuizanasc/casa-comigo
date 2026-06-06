const db = require('../config/database');

function getPerformanceReport(houseId, { dateFrom, dateTo }) {
  const params = [houseId];
  let dateFilter = '';
  if (dateFrom) { dateFilter += ' AND ta.scheduled_date >= ?'; params.push(dateFrom); }
  if (dateTo) { dateFilter += ' AND ta.scheduled_date <= ?'; params.push(dateTo); }

  const members = db.prepare(`
    SELECT hm.user_id, u.name, hm.role, hm.weight_percentage
    FROM house_members hm
    JOIN users u ON hm.user_id = u.id
    WHERE hm.house_id = ?
  `).all(houseId);

  const report = members.map(member => {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status = 'redistributed' THEN 1 ELSE 0 END) as redistributed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM task_assignments ta
      WHERE ta.house_id = ? AND ta.assigned_to = ? ${dateFilter}
    `).get(houseId, member.user_id, ...params.slice(1));

    const completionRate = stats.total > 0
      ? parseFloat(((stats.completed / stats.total) * 100).toFixed(1))
      : 0;

    return {
      user_id: member.user_id,
      name: member.name,
      role: member.role,
      weight_percentage: member.weight_percentage,
      total_assigned: stats.total,
      completed: stats.completed,
      overdue: stats.overdue,
      redistributed: stats.redistributed,
      pending: stats.pending,
      completion_rate: completionRate,
    };
  });

  return { period: { from: dateFrom || null, to: dateTo || null }, members: report };
}

function getBalancePanel(houseId) {
  const house = db.prepare('SELECT tolerance_percentage FROM houses WHERE id = ?').get(houseId);
  const members = db.prepare(`
    SELECT hm.user_id, u.name, hm.weight_percentage, hm.role
    FROM house_members hm
    JOIN users u ON hm.user_id = u.id
    WHERE hm.house_id = ?
  `).all(houseId);

  const membersWithWeights = members.filter(m => m.weight_percentage !== null);
  const usingEqual = membersWithWeights.length === 0;
  const equalWeight = 100 / members.length;

  // Total effort across all pending/completed assignments
  const effortByMember = {};
  members.forEach(m => { effortByMember[m.user_id] = 0; });

  const assignments = db.prepare(`
    SELECT ta.assigned_to, t.effort_level
    FROM task_assignments ta
    JOIN task_catalog t ON ta.task_id = t.id
    WHERE ta.house_id = ? AND ta.status != 'redistributed'
  `).all(houseId);

  const WEIGHT = { light: 1, medium: 2, heavy: 3 };
  assignments.forEach(a => {
    if (effortByMember[a.assigned_to] !== undefined) {
      effortByMember[a.assigned_to] += WEIGHT[a.effort_level];
    }
  });

  const totalEffort = Object.values(effortByMember).reduce((s, v) => s + v, 0);
  const tolerance = house.tolerance_percentage;

  const balanceData = members.map(m => {
    const target = usingEqual ? equalWeight : (m.weight_percentage || equalWeight);
    const actual = totalEffort > 0 ? (effortByMember[m.user_id] / totalEffort) * 100 : 0;
    const deviation = actual - target;
    return {
      user_id: m.user_id,
      name: m.name,
      target_percentage: parseFloat(target.toFixed(1)),
      actual_percentage: parseFloat(actual.toFixed(1)),
      deviation: parseFloat(deviation.toFixed(1)),
      within_tolerance: Math.abs(deviation) <= tolerance,
    };
  });

  return {
    using_equal_distribution: usingEqual,
    tolerance_percentage: tolerance,
    within_tolerance: balanceData.every(b => b.within_tolerance),
    members: balanceData,
  };
}

module.exports = { getPerformanceReport, getBalancePanel };
