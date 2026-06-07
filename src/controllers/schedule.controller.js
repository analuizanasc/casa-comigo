const scheduleService = require('../services/schedule.service');
const distributionService = require('../services/distribution.service');

function distribute(req, res) {
  try {
    const { period_start, period_end, period_label } = req.body;
    if (!period_start || !period_end) {
      return res.status(400).json({ error: 'Campos obrigatórios: period_start, period_end (YYYY-MM-DD).' });
    }
    if (new Date(period_start) > new Date(period_end)) {
      return res.status(400).json({ error: 'period_start deve ser anterior a period_end.' });
    }
    const result = distributionService.distribute({
      houseId: req.params.houseId,
      periodStart: period_start,
      periodEnd: period_end,
      periodLabel: period_label || `${period_start}_${period_end}`,
      requesterId: req.user.id,
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getSchedule(req, res) {
  try {
    const { date_from, date_to, assigned_to } = req.query;
    const assignments = scheduleService.getSchedule({
      houseId: req.params.houseId,
      userId: req.user.id,
      role: req.member.role,
      dateFrom: date_from,
      dateTo: date_to,
      assignedTo: assigned_to,
    });
    return res.status(200).json(assignments);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getAssignment(req, res) {
  try {
    const assignment = scheduleService.getAssignment(req.params.assignmentId, req.params.houseId);
    return res.status(200).json(assignment);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function reassignTask(req, res) {
  try {
    const { assigned_to, force, move_group } = req.body;
    if (!assigned_to) return res.status(400).json({ error: 'Campo obrigatório: assigned_to (user_id).' });
    const result = scheduleService.reassignTask({
      assignmentId: req.params.assignmentId,
      houseId: req.params.houseId,
      newUserId: assigned_to,
      force: !!force,
      moveGroup: !!move_group,
    });
    // Retorna 200 mesmo no caso de confirmação pendente (requires_confirmation)
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function completeTask(req, res) {
  try {
    const result = scheduleService.completeTask({
      assignmentId: req.params.assignmentId,
      houseId: req.params.houseId,
      userId: req.user.id,
      completionNotes: req.body.completion_notes,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function reportImpediment(req, res) {
  try {
    const result = scheduleService.reportImpediment({
      assignmentId: req.params.assignmentId,
      houseId: req.params.houseId,
      userId: req.user.id,
    });
    return res.status(200).json({ message: 'Tarefa redistribuída com sucesso.', new_assignment: result });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { distribute, getSchedule, getAssignment, reassignTask, completeTask, reportImpediment };
