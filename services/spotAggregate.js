const db = require('../config/db');
const { RISK_LEVELS } = require('./constants');

const reportsForSpotStmt = db.prepare('SELECT * FROM reports WHERE spot_id = ? ORDER BY created_at ASC');

function riskRank(level) {
  const idx = RISK_LEVELS.indexOf(level);
  return idx === -1 ? 0 : idx;
}

function safeJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getPinColor({ status, riskLevel, hasIssueReports }) {
  if (status === '해결됨') return 'green';
  if (!hasIssueReports) return 'blue';
  if (riskLevel === '매우 높음' || riskLevel === '높음') return 'red';
  if (riskLevel === '보통') return 'orange';
  return 'yellow';
}

/**
 * 스팟에 딸린 모든 신고(issue+congestion)를 모아 지도/필터에 필요한 집계 정보를 만든다.
 */
function buildSpotSummary(spot) {
  const reports = reportsForSpotStmt.all(spot.id);
  const issueReports = reports.filter((r) => r.kind === 'issue');
  const congestionReports = reports.filter((r) => r.kind === 'congestion');

  const problemTypes = new Set();
  const timeBands = new Set();
  const targets = new Set();
  const congestionLevels = new Set();
  let highestRisk = spot.risk_level || '낮음';

  issueReports.forEach((r) => {
    safeJsonArray(r.problem_types).forEach((t) => problemTypes.add(t));
    safeJsonArray(r.ai_problem_types).forEach((t) => problemTypes.add(t));
    if (r.custom_problem_type) problemTypes.add(r.custom_problem_type);
    if (r.time_band) timeBands.add(r.time_band);
    if (r.ai_time_band) timeBands.add(r.ai_time_band);
    if (r.pedestrian_type) targets.add(r.pedestrian_type);
    if (r.ai_target) targets.add(r.ai_target);
    if (r.congestion_level) congestionLevels.add(r.congestion_level);
    const effectiveRisk = r.ai_risk_level || r.risk_level;
    if (effectiveRisk && riskRank(effectiveRisk) > riskRank(highestRisk)) highestRisk = effectiveRisk;
  });

  congestionReports.forEach((r) => {
    if (r.congestion_level) congestionLevels.add(r.congestion_level);
  });

  const congestionByTimeBand = {};
  congestionReports.forEach((r) => {
    if (!r.congestion_time_band) return;
    if (!congestionByTimeBand[r.congestion_time_band]) congestionByTimeBand[r.congestion_time_band] = [];
    congestionByTimeBand[r.congestion_time_band].push(r.congestion_level);
  });

  const pinColor = getPinColor({
    status: spot.status,
    riskLevel: highestRisk,
    hasIssueReports: issueReports.length > 0,
  });

  return {
    ...spot,
    problemTypes: Array.from(problemTypes),
    timeBands: Array.from(timeBands),
    targets: Array.from(targets),
    congestionLevels: Array.from(congestionLevels),
    congestionByTimeBand,
    highestRisk,
    pinColor,
    issueCount: issueReports.length,
    congestionSubmissionCount: congestionReports.length,
    reports,
  };
}

/**
 * 새 이슈 제보가 들어온 뒤 스팟의 위험도/상태를 재계산한다.
 * 이미 공식 신고 완료/해결됨 단계로 넘어간 스팟은 자동으로 되돌리지 않는다.
 */
function updateSpotAggregateStatus(spotId) {
  const spot = db.prepare('SELECT * FROM spots WHERE id = ?').get(spotId);
  const summary = buildSpotSummary(spot);

  let nextStatus = spot.status;
  if (spot.status === '접수됨') nextStatus = '확인 필요';

  db.prepare(`
    UPDATE spots SET risk_level = @riskLevel, status = @status, updated_at = datetime('now') WHERE id = @id
  `).run({ riskLevel: summary.highestRisk, status: nextStatus, id: spotId });
}

function matchesFilter(summary, filters) {
  if (filters.problemType.length && !filters.problemType.some((t) => summary.problemTypes.includes(t))) return false;
  if (filters.risk.length && !filters.risk.includes(summary.highestRisk)) return false;
  if (filters.timeBand.length && !filters.timeBand.some((t) => summary.timeBands.includes(t))) return false;
  if (filters.target.length && !filters.target.some((t) => summary.targets.includes(t))) return false;
  if (filters.status.length && !filters.status.includes(summary.status)) return false;
  if (filters.congestion.length && !filters.congestion.some((c) => summary.congestionLevels.includes(c))) return false;
  if (filters.dong.length && !filters.dong.includes(summary.dong)) return false;
  return true;
}

module.exports = { buildSpotSummary, updateSpotAggregateStatus, matchesFilter, getPinColor };
