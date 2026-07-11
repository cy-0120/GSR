const db = require('../config/db');
const { analyzeReport, buildReportText } = require('./aiService');
const { ESCALATION_THRESHOLD } = require('./constants');

/**
 * 스팟에 누적된 신고가 5건 이상이면 고위험 지역으로 자동 격상하고,
 * AI가 여러 제보를 종합한 공식 민원 신고문을 생성한다.
 * 개발자가 이 신고문을 확인 후 안전신문고 등 공식 채널에 직접 접수한다.
 */
async function maybeEscalate(spot) {
  if (spot.escalated) return spot;

  const issueReports = await db.all(
    `SELECT * FROM reports WHERE spot_id = @spotId AND kind = 'issue' ORDER BY created_at ASC`,
    { spotId: spot.id },
  );
  if (issueReports.length < ESCALATION_THRESHOLD) return spot;

  const combinedDetail = issueReports
    .map((r, i) => {
      const custom = r.custom_problem_type ? ` [기타: ${r.custom_problem_type}]` : '';
      return `(${i + 1}) ${r.detail || ''}${custom}`.trim();
    })
    .filter(Boolean)
    .join('\n');

  const problemTypeSet = new Set();
  issueReports.forEach((r) => {
    (JSON.parse(r.problem_types || '[]')).forEach((t) => problemTypeSet.add(t));
    (JSON.parse(r.ai_problem_types || '[]')).forEach((t) => problemTypeSet.add(t));
    if (r.custom_problem_type) problemTypeSet.add(r.custom_problem_type);
  });

  let analysis;
  try {
    analysis = await analyzeReport({
      detail: combinedDetail,
      problemTypes: Array.from(problemTypeSet),
      timeBand: issueReports[issueReports.length - 1].time_band,
      pedestrianType: issueReports[issueReports.length - 1].pedestrian_type,
      dong: spot.dong,
      lat: spot.lat,
      lng: spot.lng,
    });
  } catch (err) {
    console.error('[escalation] AI 분석 실패:', err.message);
    analysis = {
      problemTypes: Array.from(problemTypeSet),
      target: issueReports[issueReports.length - 1].pedestrian_type || '보행자',
      recommendedActions: [],
      reportText: buildReportText({
        dong: spot.dong,
        lat: spot.lat,
        lng: spot.lng,
        detail: combinedDetail,
        problemTypes: Array.from(problemTypeSet),
        target: '보행자',
        timeBand: issueReports[issueReports.length - 1].time_band || '저녁',
        riskLevel: '매우 높음',
        recommendedActions: [],
        cumulativeCount: issueReports.length,
      }),
    };
  }

  const finalReportText = `${analysis.reportText}\n\n(누적 신고 ${issueReports.length}건으로 고위험 지역 자동 격상됨)`;

  await db.run(
    `UPDATE spots SET
      risk_level = '매우 높음',
      status = '신고문 생성',
      escalated = 1,
      ai_report_text = @aiReportText,
      ai_recommended_actions = @aiRecommendedActions,
      ai_target = @aiTarget,
      updated_at = datetime('now')
    WHERE id = @id`,
    {
      id: spot.id,
      aiReportText: finalReportText,
      aiRecommendedActions: JSON.stringify(analysis.recommendedActions || []),
      aiTarget: analysis.target || null,
    },
  );

  return db.get('SELECT * FROM spots WHERE id = @id', { id: spot.id });
}

module.exports = { maybeEscalate };
