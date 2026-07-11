require('dotenv').config();
const path = require('path');
const express = require('express');

require('./config/db'); // DB 클라이언트 생성 (스키마 준비는 첫 쿼리 시 지연 초기화)

const metaRoutes = require('./routes/meta');
const spotsRoutes = require('./routes/spots');
const reportsRoutes = require('./routes/reports');
const congestionRoutes = require('./routes/congestion');
const aiRoutes = require('./routes/ai');
const geocodeRoutes = require('./routes/geocode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/meta', metaRoutes);
app.use('/api/spots', spotsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/congestion', congestionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/geocode', geocodeRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
  console.log(`강남 안전핀 서버 실행 중: http://localhost:${PORT}`);
});
