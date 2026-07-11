const express = require('express');
const db = require('../config/db');
const { findOrCreateSpot } = require('../services/clustering');
const { checkCooldown } = require('../services/abuseGuard');
const { buildSpotSummary } = require('../services/spotAggregate');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { deviceId, lat, lng, dong, congestionLevel, congestionTimeBand } = req.body;

    if (!deviceId || lat === undefined || lng === undefined || !congestionLevel || !congestionTimeBand) {
      return res.status(400).json({ error: 'deviceId, lat, lng, congestionLevel, congestionTimeBand는 필수입니다.' });
    }
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ error: '위치 좌표가 올바르지 않습니다.' });
    }

    const remainingCooldownMs = await checkCooldown(deviceId, latNum, lngNum);
    if (remainingCooldownMs) {
      return res.status(429).json({
        error: '동일한 장소에 최근 제보 이력이 있습니다. 잠시 후 다시 시도해 주세요.',
        remainingCooldownMs,
      });
    }

    const spot = await findOrCreateSpot(latNum, lngNum, dong);

    const info = await db.run(
      `INSERT INTO reports (spot_id, kind, device_id, lat, lng, dong, congestion_level, congestion_time_band)
       VALUES (@spotId, 'congestion', @deviceId, @lat, @lng, @dong, @congestionLevel, @congestionTimeBand)`,
      {
        spotId: spot.id,
        deviceId,
        lat: latNum,
        lng: lngNum,
        dong: dong || null,
        congestionLevel,
        congestionTimeBand,
      },
    );

    await db.run(
      `UPDATE spots SET congestion_count = congestion_count + 1, updated_at = datetime('now') WHERE id = @id`,
      { id: spot.id },
    );

    const updatedSpot = await db.get('SELECT * FROM spots WHERE id = @id', { id: spot.id });
    const report = await db.get('SELECT * FROM reports WHERE id = @id', { id: info.lastInsertRowid });

    res.status(201).json({ report, spot: await buildSpotSummary(updatedSpot) });
  } catch (err) {
    console.error('[POST /api/congestion]', err);
    res.status(500).json({ error: '혼잡도 제보 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
