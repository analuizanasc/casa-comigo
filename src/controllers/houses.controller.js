const housesService = require('../services/houses.service');

function createHouse(req, res) {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Nome da casa é obrigatório.' });
    }
    const house = housesService.createHouse({ name: name.trim(), userId: req.user.id });
    return res.status(201).json(house);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getMyHouses(req, res) {
  try {
    const houses = housesService.getMyHouses(req.user.id);
    return res.status(200).json(houses);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getHouse(req, res) {
  try {
    const house = housesService.getHouseById(req.params.houseId, req.user.id);
    if (!house) return res.status(404).json({ error: 'Casa não encontrada.' });
    return res.status(200).json(house);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function joinHouse(req, res) {
  try {
    const { invite_code } = req.body;
    if (!invite_code) {
      return res.status(400).json({ error: 'Código de convite é obrigatório.' });
    }
    const house = housesService.joinByInviteCode({ inviteCode: invite_code, userId: req.user.id });
    return res.status(200).json(house);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function updateTolerance(req, res) {
  try {
    const { tolerance_percentage } = req.body;
    if (tolerance_percentage === undefined) {
      return res.status(400).json({ error: 'Campo obrigatório: tolerance_percentage.' });
    }
    housesService.updateTolerance(req.params.houseId, Number(tolerance_percentage));
    return res.status(200).json({ message: 'Tolerância atualizada com sucesso.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { createHouse, getMyHouses, getHouse, joinHouse, updateTolerance };
