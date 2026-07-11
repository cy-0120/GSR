const express = require('express');
const db = require('../config/db');
const { buildSpotSummary, matchesFilter } = require('../services/spotAggregate');
const { OFFICIAL_CHANNELS, STATUSES } = require('../services/constants');

const router = express.Router();

function parseListParam(value) {
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

router.get('/', (req, res) => {
  const filters = {
    problemType: parseListParam(req.query.problemType),
    risk: parseListParam(req.query.risk),
    timeBand: parseListParam(req.query.timeBand),
    target: parseListParam(req.query.target),
    status: parseListParam(req.query.status),
    congestion: parseListParam(req.query.congestion),
    dong: parseListParam(req.query.dong),
  };

  const spots = db.prepare('SELECT * FROM spots ORDER BY updated_at DESC').all();
  const summaries = spots
    .map(buildSpotSummary)
    .filter((s) => matchesFilter(s, filters))
    .map(({ reports, ...rest }) => rest);

  res.json({ spots: summaries });
});

router.get('/:id', (req, res) => {
  const spot = db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
  if (!spot) return res.status(404).json({ error: '스팟을 찾을 수 없습니다.' });
  res.json({ spot: buildSpotSummary(spot), officialChannels: OFFICIAL_CHANNELS });
});

router.post('/:id/complaint', (req, res) => {
  const spot = db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
  if (!spot) return res.status(404).json({ error: '스팟을 찾을 수 없습니다.' });

  const { complaintNumber, channel } = req.body;
  db.prepare(`
    UPDATE spots SET complaint_number = ?, complaint_channel = ?, status = '공식 신고 완료', updated_at = datetime('now')
    WHERE id = ?
  `).run(complaintNumber || null, channel || null, req.params.id);

  const updated = db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
  res.json({ spot: buildSpotSummary(updated) });
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 처리 상태입니다.' });
  }
  const spot = db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
  if (!spot) return res.status(404).json({ error: '스팟을 찾을 수 없습니다.' });

  db.prepare(`UPDATE spots SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
  res.json({ spot: buildSpotSummary(updated) });
});

module.exports = router;
