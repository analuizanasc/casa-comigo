const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const EFFORT_WEIGHT = { light: 1, medium: 2, heavy: 3 };
const PREFERENCE_SCORE = { like: 2, neutral: 0, hate: -3 };

// Parse YYYY-MM-DD date string as UTC to avoid timezone shift issues
function parseUTCDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtUTC(d) {
  return d.toISOString().split('T')[0];
}

// Expand tasks into (task, date) occurrences between start and end dates
function expandOccurrences(tasks, startDate, endDate) {
  const start = parseUTCDate(startDate);
  const end = parseUTCDate(endDate);
  const occurrences = [];

  tasks.forEach(task => {
    const dates = getDatesForFrequency(task.frequency, start, end);
    dates.forEach(date => occurrences.push({ task, date }));
  });

  return occurrences;
}

function getDatesForFrequency(frequency, start, end) {
  const dates = [];
  const current = new Date(start);

  switch (frequency) {
    case 'daily':
      while (current <= end) {
        dates.push(fmtUTC(current));
        current.setUTCDate(current.getUTCDate() + 1);
      }
      break;
    case 'weekly':
      while (current <= end) {
        dates.push(fmtUTC(current));
        current.setUTCDate(current.getUTCDate() + 7);
      }
      break;
    case 'biweekly':
      while (current <= end) {
        dates.push(fmtUTC(current));
        current.setUTCDate(current.getUTCDate() + 14);
      }
      break;
    case 'monthly':
      while (current <= end) {
        dates.push(fmtUTC(current));
        current.setUTCMonth(current.getUTCMonth() + 1);
      }
      break;
    case 'quarterly':
      while (current <= end) {
        dates.push(fmtUTC(current));
        current.setUTCMonth(current.getUTCMonth() + 3);
      }
      break;
    case 'annual':
      while (current <= end) {
        dates.push(fmtUTC(current));
        current.setUTCFullYear(current.getUTCFullYear() + 1);
      }
      break;
  }

  return dates;
}

// Group task occurrences by (room + dependency chain) for each date — RN01
function groupOccurrencesByRoomAndDependencies(occurrences, allDeps) {
  // Build adjacency list: task -> depends_on_task
  const depMap = {};
  allDeps.forEach(d => {
    if (!depMap[d.task_id]) depMap[d.task_id] = [];
    depMap[d.task_id].push(d.depends_on_task_id);
  });

  // Group occurrences by date then by (room or dependency group)
  const byDate = {};
  occurrences.forEach(occ => {
    if (!byDate[occ.date]) byDate[occ.date] = [];
    byDate[occ.date].push(occ);
  });

  const groups = [];

  Object.entries(byDate).forEach(([date, dayOccs]) => {
    // Find dependency chains within the same day
    const taskIds = new Set(dayOccs.map(o => o.task.id));
    const visited = new Set();

    // Union-find to group interdependent tasks
    const parent = {};
    dayOccs.forEach(o => { parent[o.task.id] = o.task.id; });

    const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const union = (a, b) => { parent[find(a)] = find(b); };

    dayOccs.forEach(occ => {
      const deps = depMap[occ.task.id] || [];
      deps.forEach(depId => {
        if (taskIds.has(depId)) union(occ.task.id, depId);
      });
      // Also group by room
      if (occ.task.room) {
        dayOccs.forEach(other => {
          if (other.task.room === occ.task.room && other.task.id !== occ.task.id) {
            union(occ.task.id, other.task.id);
          }
        });
      }
    });

    // Build groups from union-find roots
    const groupMap = {};
    dayOccs.forEach(occ => {
      const root = find(occ.task.id);
      if (!groupMap[root]) groupMap[root] = [];
      groupMap[root].push(occ);
    });

    Object.values(groupMap).forEach(groupOccs => {
      // Sort within group by dependency order (topological sort)
      const sortedOccs = topologicalSort(groupOccs, depMap);
      groups.push({ date, tasks: sortedOccs });
    });
  });

  return groups;
}

function topologicalSort(occs, depMap) {
  const ids = new Set(occs.map(o => o.task.id));
  const inDegree = {};
  occs.forEach(o => { inDegree[o.task.id] = 0; });

  occs.forEach(o => {
    const deps = (depMap[o.task.id] || []).filter(d => ids.has(d));
    inDegree[o.task.id] = deps.length;
  });

  const queue = occs.filter(o => inDegree[o.task.id] === 0);
  const sorted = [];

  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);
    // Find tasks that depend on current
    occs.forEach(o => {
      const deps = (depMap[o.task.id] || []).filter(d => ids.has(d));
      if (deps.includes(current.task.id)) {
        inDegree[o.task.id]--;
        if (inDegree[o.task.id] === 0) queue.push(o);
      }
    });
  }

  // Append any remaining (circular ref fallback)
  occs.forEach(o => { if (!sorted.find(s => s.task.id === o.task.id)) sorted.push(o); });
  return sorted;
}

// Calculate total effort for a group
function groupEffort(tasks) {
  return tasks.reduce((sum, occ) => sum + EFFORT_WEIGHT[occ.task.effort_level], 0);
}

// Score a member for a group of tasks
function scoreMember(member, tasks, prefMap, currentEffort, targetEffort) {
  // Check physical limitation — RN03
  for (const occ of tasks) {
    const pref = prefMap[`${member.user_id}:${occ.task.id}`];
    if (pref && pref.has_physical_limitation) return -Infinity;
  }

  // Preference score
  let prefScore = 0;
  tasks.forEach(occ => {
    const pref = prefMap[`${member.user_id}:${occ.task.id}`];
    prefScore += PREFERENCE_SCORE[pref?.preference_level || 'neutral'];
  });

  // Load balance score — RN02: prefer member with lowest current/target ratio
  /* istanbul ignore next -- targetEffort deriva de totalEffort*percent/100, só é 0 com groups vazio (forEach não executa) */
  const ratio = targetEffort > 0 ? currentEffort / targetEffort : currentEffort;
  const balanceScore = -ratio * 10;

  return prefScore + balanceScore;
}

function distribute({ houseId, periodStart, periodEnd, periodLabel, requesterId }) {
  const tasks = db.prepare(
    'SELECT * FROM task_catalog WHERE house_id = ? AND is_active = 1'
  ).all(houseId);

  if (tasks.length === 0) {
    const err = new Error('Nenhuma tarefa ativa no catálogo para distribuir.');
    err.status = 400;
    throw err;
  }

  const members = db.prepare(`
    SELECT hm.user_id, u.name, hm.weight_percentage, hm.weekly_availability_hours, hm.role
    FROM house_members hm
    JOIN users u ON hm.user_id = u.id
    WHERE hm.house_id = ?
  `).all(houseId);

  if (members.length === 0) {
    const err = new Error('Nenhum membro na casa para distribuir tarefas.');
    err.status = 400;
    throw err;
  }

  const allDeps = db.prepare(`
    SELECT td.task_id, td.depends_on_task_id
    FROM task_dependencies td
    JOIN task_catalog t ON td.task_id = t.id
    WHERE t.house_id = ?
  `).all(houseId);

  const prefRows = db.prepare(
    'SELECT user_id, task_id, preference_level, has_physical_limitation FROM member_preferences WHERE house_id = ?'
  ).all(houseId);

  const prefMap = {};
  prefRows.forEach(p => { prefMap[`${p.user_id}:${p.task_id}`] = p; });

  // RN02: compute target weights
  const membersWithWeights = members.filter(m => m.weight_percentage !== null);
  const usingEqual = membersWithWeights.length === 0;
  const equalWeight = 100 / members.length;

  const memberEffortTargets = {};
  const memberCurrentEffort = {};
  members.forEach(m => {
    memberEffortTargets[m.user_id] = usingEqual ? equalWeight : (m.weight_percentage || equalWeight);
    memberCurrentEffort[m.user_id] = 0;
  });

  const occurrences = expandOccurrences(tasks, periodStart, periodEnd);
  const groups = groupOccurrencesByRoomAndDependencies(occurrences, allDeps);

  // Sort groups by total effort descending so heaviest tasks are assigned first
  groups.sort((a, b) => groupEffort(b.tasks) - groupEffort(a.tasks));

  const totalEffort = groups.reduce((sum, g) => sum + groupEffort(g.tasks), 0);

  // Scale targets to total effort units
  const effortTargetByMember = {};
  members.forEach(m => {
    effortTargetByMember[m.user_id] = totalEffort * (memberEffortTargets[m.user_id] / 100);
  });

  const assignments = [];

  groups.forEach(group => {
    const effort = groupEffort(group.tasks);
    const groupId = uuidv4();

    // Score each member
    let bestMember = null;
    let bestScore = -Infinity;

    members.forEach(member => {
      const score = scoreMember(
        member, group.tasks, prefMap,
        memberCurrentEffort[member.user_id],
        effortTargetByMember[member.user_id]
      );
      if (score > bestScore) {
        bestScore = score;
        bestMember = member;
      }
    });

    if (!bestMember) {
      // All members have physical limitations — assign to member with lowest load
      bestMember = members.reduce((min, m) =>
        memberCurrentEffort[m.user_id] < memberCurrentEffort[min.user_id] ? m : min
      , members[0]);
    }

    memberCurrentEffort[bestMember.user_id] += effort;

    group.tasks.forEach((occ, idx) => {
      assignments.push({
        id: uuidv4(),
        house_id: houseId,
        task_id: occ.task.id,
        assigned_to: bestMember.user_id,
        scheduled_date: group.date,
        status: 'pending',
        group_id: group.tasks.length > 1 ? groupId : null,
        sequence_order: idx,
        distribution_period: periodLabel,
      });
    });
  });

  // Persist assignments in a transaction
  const insertAssignment = db.prepare(`
    INSERT INTO task_assignments
      (id, house_id, task_id, assigned_to, scheduled_date, status, group_id, sequence_order, distribution_period)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((items) => {
    items.forEach(a => insertAssignment.run(
      a.id, a.house_id, a.task_id, a.assigned_to, a.scheduled_date,
      a.status, a.group_id, a.sequence_order, a.distribution_period
    ));
  });

  insertAll(assignments);

  // Balance report
  const house = db.prepare('SELECT tolerance_percentage FROM houses WHERE id = ?').get(houseId);
  const tolerance = house.tolerance_percentage;

  const balanceReport = members.map(m => {
    const actual = totalEffort > 0 ? (memberCurrentEffort[m.user_id] / totalEffort) * 100 : 0;
    const target = memberEffortTargets[m.user_id];
    const deviation = actual - target;
    return {
      user_id: m.user_id,
      name: m.name,
      target_percentage: target,
      actual_percentage: parseFloat(actual.toFixed(1)),
      deviation: parseFloat(deviation.toFixed(1)),
      within_tolerance: Math.abs(deviation) <= tolerance,
    };
  });

  return {
    period_start: periodStart,
    period_end: periodEnd,
    total_tasks_assigned: assignments.length,
    balance: balanceReport,
    within_tolerance: balanceReport.every(b => b.within_tolerance),
  };
}

module.exports = { distribute };
