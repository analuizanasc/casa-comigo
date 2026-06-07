const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const EFFORT_WEIGHT = { light: 1, medium: 2, heavy: 3 };
const PREFERENCE_SCORE = { like: 2, neutral: 0, hate: -3 };

function parseUTCDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtUTC(d) {
  return d.toISOString().split('T')[0];
}

// Geração de datas para frequência customizada: N vezes por semana/mês/ano
function getDatesForCustomFrequency(count, unit, start, end) {
  const UNIT_DAYS = { week: 7, month: 30, year: 365 };
  const intervalDays = Math.max(1, Math.round(UNIT_DAYS[unit] / count));
  const dates = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(fmtUTC(current));
    current.setUTCDate(current.getUTCDate() + intervalDays);
  }

  return dates;
}

function getDatesForFrequency(task, start, end) {
  // Frequência customizada tem prioridade sobre o enum
  if (task.frequency_count != null && task.frequency_unit != null) {
    return getDatesForCustomFrequency(task.frequency_count, task.frequency_unit, start, end);
  }

  const dates = [];
  const current = new Date(start);

  switch (task.frequency) {
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

function expandOccurrences(tasks, startDate, endDate) {
  const start = parseUTCDate(startDate);
  const end = parseUTCDate(endDate);
  const occurrences = [];

  tasks.forEach(task => {
    const dates = getDatesForFrequency(task, start, end);
    dates.forEach(date => occurrences.push({ task, date }));
  });

  return occurrences;
}

function groupOccurrencesByRoomAndDependencies(occurrences, allDeps) {
  const depMap = {};
  allDeps.forEach(d => {
    if (!depMap[d.task_id]) depMap[d.task_id] = [];
    depMap[d.task_id].push(d.depends_on_task_id);
  });

  const byDate = {};
  occurrences.forEach(occ => {
    if (!byDate[occ.date]) byDate[occ.date] = [];
    byDate[occ.date].push(occ);
  });

  const groups = [];

  Object.entries(byDate).forEach(([date, dayOccs]) => {
    const taskIds = new Set(dayOccs.map(o => o.task.id));

    const parent = {};
    dayOccs.forEach(o => { parent[o.task.id] = o.task.id; });

    const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const union = (a, b) => { parent[find(a)] = find(b); };

    dayOccs.forEach(occ => {
      const deps = depMap[occ.task.id] || [];
      deps.forEach(depId => {
        if (taskIds.has(depId)) union(occ.task.id, depId);
      });
      if (occ.task.room) {
        dayOccs.forEach(other => {
          if (other.task.room === occ.task.room && other.task.id !== occ.task.id) {
            union(occ.task.id, other.task.id);
          }
        });
      }
    });

    const groupMap = {};
    dayOccs.forEach(occ => {
      const root = find(occ.task.id);
      if (!groupMap[root]) groupMap[root] = [];
      groupMap[root].push(occ);
    });

    Object.values(groupMap).forEach(groupOccs => {
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
    occs.forEach(o => {
      const deps = (depMap[o.task.id] || []).filter(d => ids.has(d));
      if (deps.includes(current.task.id)) {
        inDegree[o.task.id]--;
        if (inDegree[o.task.id] === 0) queue.push(o);
      }
    });
  }

  occs.forEach(o => { if (!sorted.find(s => s.task.id === o.task.id)) sorted.push(o); });
  return sorted;
}

function groupEffort(tasks) {
  return tasks.reduce((sum, occ) => sum + EFFORT_WEIGHT[occ.task.effort_level], 0);
}

function scoreMember(member, tasks, prefMap, currentEffort, targetEffort) {
  for (const occ of tasks) {
    const pref = prefMap[`${member.user_id}:${occ.task.id}`];
    if (pref && pref.has_physical_limitation) return -Infinity;
  }

  let prefScore = 0;
  tasks.forEach(occ => {
    const pref = prefMap[`${member.user_id}:${occ.task.id}`];
    prefScore += PREFERENCE_SCORE[pref?.preference_level || 'neutral'];
  });

  /* istanbul ignore next */
  const ratio = targetEffort > 0 ? currentEffort / targetEffort : currentEffort;
  const balanceScore = -ratio * 10;

  return prefScore + balanceScore;
}

// Fallback panorama: quando todos têm limitação física, escolhe quem tem
// mais tarefas que gosta no quadro atual (in-memory + DB)
function selectByPanorama(members, houseId, inMemoryAssignments, prefMap) {
  const likedCount = {};
  members.forEach(m => { likedCount[m.user_id] = 0; });

  // Tarefas já atribuídas no DB que o membro gosta
  members.forEach(m => {
    const dbLiked = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM task_assignments ta
      JOIN member_preferences mp
        ON mp.user_id = ta.assigned_to AND mp.task_id = ta.task_id AND mp.house_id = ta.house_id
      WHERE ta.house_id = ? AND ta.assigned_to = ? AND mp.preference_level = 'like' AND ta.status = 'pending'
    `).get(houseId, m.user_id).cnt;
    likedCount[m.user_id] += dbLiked;
  });

  // Tarefas in-memory atribuídas na distribuição corrente que o membro gosta
  inMemoryAssignments.forEach(a => {
    const pref = prefMap[`${a.assigned_to}:${a.task_id}`];
    if (pref && pref.preference_level === 'like') {
      likedCount[a.assigned_to] = (likedCount[a.assigned_to] || 0) + 1;
    }
  });

  return members.reduce((best, m) =>
    likedCount[m.user_id] > likedCount[best.user_id] ? m : best
  , members[0]);
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

  groups.sort((a, b) => groupEffort(b.tasks) - groupEffort(a.tasks));

  const totalEffort = groups.reduce((sum, g) => sum + groupEffort(g.tasks), 0);

  const effortTargetByMember = {};
  members.forEach(m => {
    effortTargetByMember[m.user_id] = totalEffort * (memberEffortTargets[m.user_id] / 100);
  });

  const assignments = [];

  groups.forEach(group => {
    const effort = groupEffort(group.tasks);
    const groupId = uuidv4();

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
      // Todos têm limitação física: usa fallback panorama (quem tem mais tarefas que gosta)
      bestMember = selectByPanorama(members, houseId, assignments, prefMap);
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
