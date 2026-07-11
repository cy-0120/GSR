const db = require('../config/db');
const { distanceMeters } = require('./geo');
const { ABUSE_COOLDOWN_MS, CLUSTER_RADIUS_METERS } = require('./constants');

/**
 * 동일 디바이스가 같은 장소(반경 10m)에서 1시간 이내 재신고하는 것을 차단한다.
 * 통과하면 null, 막히면 남은 쿨타임(ms)을 반환한다.
 */
async function checkCooldown(deviceId, lat, lng) {
  const sinceOffset = `-${Math.ceil(ABUSE_COOLDOWN_MS / 1000)} seconds`;
  const recent = await db.all(
    `SELECT * FROM reports WHERE device_id = @deviceId AND created_at >= datetime('now', @sinceOffset)`,
    { deviceId, sinceOffset },
  );

  let blockedUntilMs = 0;
  for (const report of recent) {
    const d = distanceMeters(lat, lng, report.lat, report.lng);
    if (d <= CLUSTER_RADIUS_METERS) {
      const reportedAt = new Date(`${report.created_at}Z`).getTime();
      const cooldownEnds = reportedAt + ABUSE_COOLDOWN_MS;
      if (cooldownEnds > blockedUntilMs) blockedUntilMs = cooldownEnds;
    }
  }

  if (blockedUntilMs > Date.now()) {
    return blockedUntilMs - Date.now();
  }
  return null;
}

module.exports = { checkCooldown };
