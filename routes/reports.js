const express = require('express');
const multer = require('multer');
const db = require('../config/db');
const { findOrCreateSpot } = require('../services/clustering');
const { checkCooldown } = require('../services/abuseGuard');
const { analyzeReport } = require('../services/aiService');
const { maybeEscalate } = require('../services/escalation');
const { buildSpotSummary, updateSpotAggregateStatus } = require('../services/spotAggregate');
const { savePhoto } = require('../services/photoStorage');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '사진 용량이 너무 큽니다. 더 작은 사진으로 다시 시도해 주세요.' });
  }
  next(err);
});
function parseArrayField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return String(value).split(',').map((s) => s.trim()).filter(Boolean);
  }
}

router.post('/', upload.single('photo'), async (req, res) => {
  if (req.fileValidationError) {
    return res.status(413).json({ error: '사진 용량이 너무 큽니다. 더 작은 사진으로 다시 시도해 주세요.' });
  }

  try {
    const {
      deviceId, lat, lng, dong, detail,
      timeBand, congestionLevel, pedestrianType, customProblemType,
    } = req.body;
    const problemTypes = parseArrayField(req.body.problemTypes);

    if (!deviceId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'deviceId, lat, lng는 필수입니다.' });
    }
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ error: '위치 좌표가 올바르지 않습니다.' });
    }
    if (!detail && problemTypes.length === 0) {
      return res.status(400).json({ error: '문제 유형 또는 상세 내용을 입력해 주세요.' });
    }

    const remainingCooldownMs = await checkCooldown(deviceId, latNum, lngNum);
    if (remainingCooldownMs) {
      return res.status(429).json({
        error: '동일한 장소에 최근 신고 이력이 있습니다. 잠시 후 다시 시도해 주세요.',
        remainingCooldownMs,
      });
    }

    const spot = await findOrCreateSpot(latNum, lngNum, dong);

    const detailForAi = customProblemType
      ? `${detail || ''}\n[기타 문제 유형] ${customProblemType}`.trim()
      : detail;

    // 위험도는 사용자가 입력하지 않고 AI가 제보 내용을 분석해 자동으로 배정한다.
    const analysis = await analyzeReport({
      detail: detailForAi, problemTypes, timeBand, pedestrianType, dong, lat: latNum, lng: lngNum,
    });

    const photoPath = await savePhoto(req.file);

    const info = await db.run(
      `INSERT INTO reports (
        spot_id, kind, device_id, lat, lng, dong, problem_types, custom_problem_type, detail, photo_path,
        time_band, risk_level, congestion_level, pedestrian_type,
        ai_problem_types, ai_target, ai_time_band, ai_risk_level, ai_recommended_actions, ai_report_text
      ) VALUES (
        @spotId, 'issue', @deviceId, @lat, @lng, @dong, @problemTypes, @customProblemType, @detail, @photoPath,
        @timeBand, @riskLevel, @congestionLevel, @pedestrianType,
        @aiProblemTypes, @aiTarget, @aiTimeBand, @aiRiskLevel, @aiRecommendedActions, @aiReportText
      )`,
      {
        spotId: spot.id,
        deviceId,
        lat: latNum,
        lng: lngNum,
        dong: dong || null,
        problemTypes: JSON.stringify(problemTypes),
        customProblemType: customProblemType || null,
        detail: detail || null,
        photoPath,
        timeBand: timeBand || null,
        riskLevel: analysis.riskLevel || null,
        congestionLevel: congestionLevel || null,
        pedestrianType: pedestrianType || null,
        aiProblemTypes: JSON.stringify(analysis.problemTypes || []),
        aiTarget: analysis.target || null,
        aiTimeBand: analysis.timeBand || null,
        aiRiskLevel: analysis.riskLevel || null,
        aiRecommendedActions: JSON.stringify(analysis.recommendedActions || []),
        aiReportText: analysis.reportText || null,
      },
    );

    await db.run(
      `UPDATE spots SET report_count = report_count + 1, updated_at = datetime('now') WHERE id = @id`,
      { id: spot.id },
    );
    await updateSpotAggregateStatus(spot.id);

    let updatedSpot = await db.get('SELECT * FROM spots WHERE id = @id', { id: spot.id });
    updatedSpot = await maybeEscalate(updatedSpot);

    const report = await db.get('SELECT * FROM reports WHERE id = @id', { id: info.lastInsertRowid });

    res.status(201).json({
      report,
      analysis,
      spot: await buildSpotSummary(updatedSpot),
    });
  } catch (err) {
    console.error('[POST /api/reports]', err);
    res.status(500).json({ error: '제보 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
