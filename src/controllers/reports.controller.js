const reportsService = require('../services/reports.service');

function getPerformanceReport(req, res) {
  try {
    const { date_from, date_to } = req.query;
    const report = reportsService.getPerformanceReport(req.params.houseId, { dateFrom: date_from, dateTo: date_to });
    return res.status(200).json(report);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getBalancePanel(req, res) {
  try {
    const panel = reportsService.getBalancePanel(req.params.houseId);
    return res.status(200).json(panel);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { getPerformanceReport, getBalancePanel };
