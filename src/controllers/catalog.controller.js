const catalogService = require('../services/catalog.service');

function listTasks(req, res) {
  try {
    const tasks = catalogService.listTasks(req.params.houseId);
    return res.status(200).json(tasks);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getTask(req, res) {
  try {
    const task = catalogService.getTask(req.params.taskId, req.params.houseId);
    return res.status(200).json(task);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function createTask(req, res) {
  try {
    const task = catalogService.createTask({ houseId: req.params.houseId, userId: req.user.id, body: req.body });
    return res.status(201).json(task);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function updateTask(req, res) {
  try {
    const task = catalogService.updateTask({ taskId: req.params.taskId, houseId: req.params.houseId, body: req.body });
    return res.status(200).json(task);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function deleteTask(req, res) {
  try {
    catalogService.deleteTask(req.params.taskId, req.params.houseId);
    return res.status(200).json({ message: 'Tarefa removida com sucesso.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function addDependency(req, res) {
  try {
    const { depends_on_task_id } = req.body;
    if (!depends_on_task_id) return res.status(400).json({ error: 'Campo obrigatório: depends_on_task_id.' });
    catalogService.addDependency({ taskId: req.params.taskId, dependsOnTaskId: depends_on_task_id, houseId: req.params.houseId });
    return res.status(201).json({ message: 'Dependência adicionada com sucesso.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function removeDependency(req, res) {
  try {
    catalogService.removeDependency({ taskId: req.params.taskId, dependsOnTaskId: req.params.dependsOnId });
    return res.status(200).json({ message: 'Dependência removida com sucesso.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask, addDependency, removeDependency };
