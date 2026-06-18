require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');

const { runMigrations } = require('./models/migrations');

const authRoutes = require('./routes/auth.routes');
const housesRoutes = require('./routes/houses.routes');
const membersRoutes = require('./routes/members.routes');
const catalogRoutes = require('./routes/catalog.routes');
const preferencesRoutes = require('./routes/preferences.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const reportsRoutes = require('./routes/reports.routes');
const notificationsRoutes = require('./routes/notifications.routes');

runMigrations();

const app = express();
app.use(express.json());

// Swagger
const swaggerFile = path.join(__dirname, '..', 'resources', 'swagger.yaml');
const swaggerDocument = yaml.load(fs.readFileSync(swaggerFile, 'utf8'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/houses', housesRoutes);
app.use('/api/houses/:houseId/members', membersRoutes);
app.use('/api/houses/:houseId/catalog', catalogRoutes);
app.use('/api/houses/:houseId/preferences', preferencesRoutes);
app.use('/api/houses/:houseId/schedule', scheduleRoutes);
app.use('/api/houses/:houseId/reports', reportsRoutes);
// Health check — must be before any router that applies authenticate to /api/*
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api', notificationsRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Casa Comigo API rodando na porta ${PORT}`);
  console.log(`Documentação: http://localhost:${PORT}/api/docs`);
});

module.exports = app;
