const express = require('express');
const { reverseGeocode } = require('../services/geocode');

const router = express.Router();

router.get('/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ error: '위치 좌표가 올바르지 않습니다.' });
    }

    const result = await reverseGeocode(latNum, lngNum);
    res.json(result);
  } catch (err) {
    console.error('[GET /api/geocode/reverse]', err);
    res.status(502).json({ error: '주소 변환에 실패했습니다.', dong: null });
  }
});

module.exports = router;
