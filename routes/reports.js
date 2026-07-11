const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../config/db');
const { findOrCreateSpot } = require('../services/clustering');
const { checkCooldown } = require('../services/abuseGuard');
const { analyzeReport } = require('../services/aiService');
const { maybeEscalate } = require('../services/escalation');
const { buildSpotSummary, updateSpotAggregateStatus } = require('../services/spotAggregate');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'public', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const insertReportStmt = db.prepare(`
  INSERT INTO reports (
    spot_id, kind, device_id, lat, lng, dong, problem_types, custom_problem_type, detail, photo_path,
    time_band, risk_level, congestion_level, pedestrian_type,
    ai_problem_types, ai_target, ai_time_band, ai_risk_level, ai_recommended_actions, ai_report_text
  ) VALUES (
    @spotId, 'issue', @deviceId, @lat, @lng, @dong, @problemTypes, @customProblemType, @detail, @photoPath,
    @timeBand, @riskLevel, @congestionLevel, @pedestrianType,
    @aiProblemTypes, @aiTarget, @aiTimeBand, @aiRiskLevel, @aiRecommendedActions, @aiReportText
  )
`);

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

    const remainingCooldownMs = checkCooldown(deviceId, latNum, lngNum);
    if (remainingCooldownMs) {
      return res.status(429).json({
        error: '동일한 장소에 최근 신고 이력이 있습니다. 잠시 후 다시 시도해 주세요.',
        remainingCooldownMs,
      });
    }

    const spot = findOrCreateSpot(latNum, lngNum, dong);

    const detailForAi = customProblemType
      ? `${detail || ''}\n[기타 문제 유형] ${customProblemType}`.trim()
      : detail;

    // 위험도는 사용자가 입력하지 않고 AI가 제보 내용을 분석해 자동으로 배정한다.
    const analysis = await analyzeReport({
      detail: detailForAi, problemTypes, timeBand, pedestrianType, dong, lat: latNum, lng: lngNum,
    });

    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

    const info = insertReportStmt.run({
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
    });

    db.prepare(`UPDATE spots SET report_count = report_count + 1, updated_at = datetime('now') WHERE id = ?`).run(spot.id);
    updateSpotAggregateStatus(spot.id);

    let updatedSpot = db.prepare('SELECT * FROM spots WHERE id = ?').get(spot.id);
    updatedSpot = await maybeEscalate(updatedSpot);

    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(info.lastInsertRowid);

    res.status(201).json({
      report,
      analysis,
      spot: buildSpotSummary(updatedSpot),
    });
  } catch (err) {
    console.error('[POST /api/reports]', err);
    res.status(500).json({ error: '제보 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
