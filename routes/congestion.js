const express = require('express');
const db = require('../config/db');
const { findOrCreateSpot } = require('../services/clustering');
const { checkCooldown } = require('../services/abuseGuard');
const { buildSpotSummary } = require('../services/spotAggregate');

const router = express.Router();

const insertCongestionStmt = db.prepare(`
  INSERT INTO reports (spot_id, kind, device_id, lat, lng, dong, congestion_level, congestion_time_band)
  VALUES (@spotId, 'congestion', @deviceId, @lat, @lng, @dong, @congestionLevel, @congestionTimeBand)
`);

router.post('/', (req, res) => {
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

    const remainingCooldownMs = checkCooldown(deviceId, latNum, lngNum);
    if (remainingCooldownMs) {
      return res.status(429).json({
        error: '동일한 장소에 최근 제보 이력이 있습니다. 잠시 후 다시 시도해 주세요.',
        remainingCooldownMs,
      });
    }

    const spot = findOrCreateSpot(latNum, lngNum, dong);

    const info = insertCongestionStmt.run({
      spotId: spot.id,
      deviceId,
      lat: latNum,
      lng: lngNum,
      dong: dong || null,
      congestionLevel,
      congestionTimeBand,
    });

    db.prepare(`UPDATE spots SET congestion_count = congestion_count + 1, updated_at = datetime('now') WHERE id = ?`).run(spot.id);

    const updatedSpot = db.prepare('SELECT * FROM spots WHERE id = ?').get(spot.id);
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(info.lastInsertRowid);

    res.status(201).json({ report, spot: buildSpotSummary(updatedSpot) });
  } catch (err) {
    console.error('[POST /api/congestion]', err);
    res.status(500).json({ error: '혼잡도 제보 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
