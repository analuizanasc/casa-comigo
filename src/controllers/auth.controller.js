const authService = require('../services/auth.service');

function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, email, password.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
    }
    const user = authService.register({ name, email, password });
    return res.status(201).json({ message: 'Usuário criado com sucesso.', user });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Campos obrigatórios: email, password.' });
    }
    const result = authService.login({ email, password });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { register, login };
