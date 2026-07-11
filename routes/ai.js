const express = require('express');
const { analyzeReport } = require('../services/aiService');

const router = express.Router();

router.post('/preview', async (req, res) => {
  try {
    const { detail, problemTypes, timeBand, pedestrianType, dong, lat, lng, customProblemType } = req.body;

    if (!detail && (!problemTypes || !problemTypes.length)) {
      return res.status(400).json({ error: '분석할 내용이 없습니다. 상세 내용을 입력해 주세요.' });
    }

    const detailForAi = customProblemType
      ? `${detail || ''}\n[기타 문제 유형] ${customProblemType}`.trim()
      : detail;

    const analysis = await analyzeReport({
      detail: detailForAi,
      problemTypes: problemTypes || [],
      timeBand,
      pedestrianType,
      dong,
      lat,
      lng,
    });

    res.json({ analysis });
  } catch (err) {
    console.error('[POST /api/ai/preview]', err);
    res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
