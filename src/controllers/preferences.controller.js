const preferencesService = require('../services/preferences.service');

function getMyPreferences(req, res) {
  try {
    const prefs = preferencesService.getMyPreferences(req.params.houseId, req.user.id);
    return res.status(200).json(prefs);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getMemberPreferences(req, res) {
  try {
    const prefs = preferencesService.getMemberPreferences(req.params.houseId, req.params.userId);
    return res.status(200).json(prefs);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function upsertPreference(req, res) {
  try {
    const { preference_level, has_physical_limitation } = req.body;
    if (!preference_level) return res.status(400).json({ error: 'Campo obrigatório: preference_level.' });
    const result = preferencesService.upsertPreference({
      houseId: req.params.houseId,
      userId: req.user.id,
      taskId: req.params.taskId,
      preferenceLevel: preference_level,
      hasPhysicalLimitation: has_physical_limitation || false,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { getMyPreferences, getMemberPreferences, upsertPreference };
