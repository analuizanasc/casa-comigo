const membersService = require('../services/members.service');

function getMembers(req, res) {
  try {
    const members = membersService.getMembers(req.params.houseId);
    return res.status(200).json(members);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function inviteMember(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail é obrigatório.' });
    const result = membersService.inviteMember({ houseId: req.params.houseId, email, invitedBy: req.user.id });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function updateRole(req, res) {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'Campo obrigatório: role.' });
    membersService.updateRole({
      houseId: req.params.houseId,
      targetUserId: req.params.userId,
      role,
      requesterId: req.user.id,
    });
    return res.status(200).json({ message: 'Papel atualizado com sucesso.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function updateWeight(req, res) {
  try {
    const { weight_percentage } = req.body;
    if (weight_percentage === undefined) return res.status(400).json({ error: 'Campo obrigatório: weight_percentage.' });
    const result = membersService.updateWeight({
      houseId: req.params.houseId,
      targetUserId: req.params.userId,
      weightPercentage: Number(weight_percentage),
    });
    return res.status(200).json({ message: 'Peso atualizado.', ...result });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function updateAvailability(req, res) {
  try {
    const { weekly_availability_hours } = req.body;
    if (weekly_availability_hours === undefined) return res.status(400).json({ error: 'Campo obrigatório: weekly_availability_hours.' });
    membersService.updateAvailability({
      houseId: req.params.houseId,
      targetUserId: req.params.userId,
      weeklyAvailabilityHours: Number(weekly_availability_hours),
    });
    return res.status(200).json({ message: 'Disponibilidade atualizada.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function removeMember(req, res) {
  try {
    membersService.removeMember({
      houseId: req.params.houseId,
      targetUserId: req.params.userId,
      requesterId: req.user.id,
    });
    return res.status(200).json({ message: 'Membro removido com sucesso.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getWeightsSummary(req, res) {
  try {
    const summary = membersService.getWeightsSummary(req.params.houseId);
    return res.status(200).json(summary);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { getMembers, inviteMember, updateRole, updateWeight, updateAvailability, removeMember, getWeightsSummary };
