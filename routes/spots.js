const express = require('express');
const db = require('../config/db');
const { buildSpotSummary, matchesFilter } = require('../services/spotAggregate');
const { OFFICIAL_CHANNELS, STATUSES } = require('../services/constants');

const router = express.Router();

function parseListParam(value) {
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

router.get('/', async (req, res) => {
  try {
    const filters = {
      problemType: parseListParam(req.query.problemType),
      risk: parseListParam(req.query.risk),
      timeBand: parseListParam(req.query.timeBand),
      target: parseListParam(req.query.target),
      status: parseListParam(req.query.status),
      congestion: parseListParam(req.query.congestion),
      dong: parseListParam(req.query.dong),
    };

    const spots = await db.all('SELECT * FROM spots ORDER BY updated_at DESC');
    const summaries = (await Promise.all(spots.map(buildSpotSummary)))
      .filter((s) => matchesFilter(s, filters))
      .map(({ reports, ...rest }) => rest);

    res.json({ spots: summaries });
  } catch (err) {
    console.error('[GET /api/spots]', err);
    res.status(500).json({ error: '스팟 목록을 불러오지 못했습니다.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const spot = await db.get('SELECT * FROM spots WHERE id = @id', { id: req.params.id });
    if (!spot) return res.status(404).json({ error: '스팟을 찾을 수 없습니다.' });
    res.json({ spot: await buildSpotSummary(spot), officialChannels: OFFICIAL_CHANNELS });
  } catch (err) {
    console.error('[GET /api/spots/:id]', err);
    res.status(500).json({ error: '스팟 정보를 불러오지 못했습니다.' });
  }
});

router.post('/:id/complaint', async (req, res) => {
  try {
    const spot = await db.get('SELECT * FROM spots WHERE id = @id', { id: req.params.id });
    if (!spot) return res.status(404).json({ error: '스팟을 찾을 수 없습니다.' });

    const { complaintNumber, channel } = req.body;
    await db.run(
      `UPDATE spots SET complaint_number = @complaintNumber, complaint_channel = @channel, status = '공식 신고 완료', updated_at = datetime('now')
       WHERE id = @id`,
      { complaintNumber: complaintNumber || null, channel: channel || null, id: req.params.id },
    );

    const updated = await db.get('SELECT * FROM spots WHERE id = @id', { id: req.params.id });
    res.json({ spot: await buildSpotSummary(updated) });
  } catch (err) {
    console.error('[POST /api/spots/:id/complaint]', err);
    res.status(500).json({ error: '민원번호 저장에 실패했습니다.' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 처리 상태입니다.' });
    }
    const spot = await db.get('SELECT * FROM spots WHERE id = @id', { id: req.params.id });
    if (!spot) return res.status(404).json({ error: '스팟을 찾을 수 없습니다.' });

    await db.run(
      `UPDATE spots SET status = @status, updated_at = datetime('now') WHERE id = @id`,
      { status, id: req.params.id },
    );
    const updated = await db.get('SELECT * FROM spots WHERE id = @id', { id: req.params.id });
    res.json({ spot: await buildSpotSummary(updated) });
  } catch (err) {
    console.error('[PATCH /api/spots/:id/status]', err);
    res.status(500).json({ error: '상태 변경에 실패했습니다.' });
  }
});

module.exports = router;
