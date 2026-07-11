const db = require('../config/db');
const { distanceMeters } = require('./geo');
const { CLUSTER_RADIUS_METERS } = require('./constants');

const findNearbySpotStmt = db.prepare('SELECT * FROM spots');
const insertSpotStmt = db.prepare(`
  INSERT INTO spots (lat, lng, dong, report_count, congestion_count, risk_level, status)
  VALUES (@lat, @lng, @dong, 0, 0, '낮음', '접수됨')
`);
const recenterSpotStmt = db.prepare(`
  UPDATE spots SET lat = @lat, lng = @lng, updated_at = datetime('now') WHERE id = @id
`);

/**
 * GPS 오차를 고려해 반경 10m 이내 신고를 하나의 위험 스팟으로 그룹화한다.
 * 기존 스팟이 없으면 새로 생성하고, 있으면 누적 평균으로 중심 좌표를 재계산한다.
 */
function findOrCreateSpot(lat, lng, dong) {
  const spots = findNearbySpotStmt.all();
  let nearest = null;
  let nearestDistance = Infinity;

  for (const spot of spots) {
    const d = distanceMeters(lat, lng, spot.lat, spot.lng);
    if (d <= CLUSTER_RADIUS_METERS && d < nearestDistance) {
      nearest = spot;
      nearestDistance = d;
    }
  }

  if (nearest) {
    const totalReports = nearest.report_count + nearest.congestion_count + 1;
    const newLat = (nearest.lat * (totalReports - 1) + lat) / totalReports;
    const newLng = (nearest.lng * (totalReports - 1) + lng) / totalReports;
    recenterSpotStmt.run({ id: nearest.id, lat: newLat, lng: newLng });
    return { ...nearest, lat: newLat, lng: newLng };
  }

  const info = insertSpotStmt.run({ lat, lng, dong: dong || null });
  return db.prepare('SELECT * FROM spots WHERE id = ?').get(info.lastInsertRowid);
}

module.exports = { findOrCreateSpot };
