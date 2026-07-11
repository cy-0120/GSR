const express = require('express');
const constants = require('../services/constants');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    problemTypes: constants.PROBLEM_TYPES,
    riskLevels: constants.RISK_LEVELS,
    timeBands: constants.TIME_BANDS,
    targets: constants.TARGETS,
    statuses: constants.STATUSES,
    congestionLevels: constants.CONGESTION_LEVELS,
    congestionTimeBands: constants.CONGESTION_TIME_BANDS,
    dongs: constants.DONGS,
    officialChannels: constants.OFFICIAL_CHANNELS,
    clusterRadiusMeters: constants.CLUSTER_RADIUS_METERS,
    abuseCooldownMs: constants.ABUSE_COOLDOWN_MS,
    escalationThreshold: constants.ESCALATION_THRESHOLD,
  });
});

module.exports = router;
