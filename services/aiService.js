const { PROBLEM_TYPES, TARGETS, TIME_BANDS, RISK_LEVELS } = require('./constants');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const ACTION_MAP = {
  '도로 파손': '도로 포장 보수',
  '보도블록 파손': '보도블록 교체 보수',
  '시설 노후화': '노후 시설물 점검 및 교체',
  '가로등 고장': '가로등 점검 및 수리',
  'CCTV 사각지대': 'CCTV 추가 설치 검토',
  '불법 주정차': '불법 주정차 단속 강화',
  '전동킥보드 방치': '방치 전동킥보드 수거 조치',
  '횡단보도 위험': '횡단보도 신호 및 노면 표시 개선',
  '골목길 어두움': '야간 조명 보강 및 순찰 강화',
  '공사장 주변 위험': '공사장 안전 펜스·표지판 점검',
  '차량 혼잡': '차량 흐름 개선 및 신호 체계 검토',
  '보행자 혼잡': '보행로 확장 또는 보행 신호 개선',
};

const KEYWORD_MAP = [
  { keywords: ['보도블록', '보도 블록'], type: '보도블록 파손' },
  { keywords: ['도로', '파손', '구멍', '포트홀'], type: '도로 파손' },
  { keywords: ['가로등', '조도', '조명'], type: '가로등 고장' },
  { keywords: ['어둡', '캄캄'], type: '골목길 어두움' },
  { keywords: ['cctv', 'CCTV', '사각지대'], type: 'CCTV 사각지대' },
  { keywords: ['불법 주정차', '주정차', '불법주차'], type: '불법 주정차' },
  { keywords: ['킥보드'], type: '전동킥보드 방치' },
  { keywords: ['횡단보도'], type: '횡단보도 위험' },
  { keywords: ['공사장', '공사 중', '공사현장'], type: '공사장 주변 위험' },
  { keywords: ['노후', '낡은', '낡아'], type: '시설 노후화' },
  { keywords: ['차량 혼잡', '차가 많', '정체'], type: '차량 혼잡' },
  { keywords: ['보행자 혼잡', '사람이 많', '붐빔', '북적'], type: '보행자 혼잡' },
];

function normalizeResult(raw, fallbackInput) {
  const problemTypes = Array.isArray(raw.problemTypes) && raw.problemTypes.length
    ? raw.problemTypes.filter((t) => typeof t === 'string')
    : (fallbackInput.problemTypes || []);
  const target = TARGETS.includes(raw.target) ? raw.target : (fallbackInput.pedestrianType || '보행자');
  const timeBand = TIME_BANDS.includes(raw.timeBand) ? raw.timeBand : (fallbackInput.timeBand || '저녁');
  const riskLevel = RISK_LEVELS.includes(raw.riskLevel) ? raw.riskLevel : (fallbackInput.riskLevel || '보통');
  const recommendedActions = Array.isArray(raw.recommendedActions) && raw.recommendedActions.length
    ? raw.recommendedActions
    : problemTypes.map((t) => ACTION_MAP[t]).filter(Boolean);
  const reportText = typeof raw.reportText === 'string' && raw.reportText.trim()
    ? raw.reportText.trim()
    : buildReportText({ ...fallbackInput, problemTypes, target, timeBand, riskLevel, recommendedActions });

  return { problemTypes, target, timeBand, riskLevel, recommendedActions, reportText };
}

function buildReportText({ dong, lat, lng, detail, problemTypes, target, timeBand, riskLevel, recommendedActions, cumulativeCount }) {
  const lines = [
    '[강남구 안전 제보 - 공식 민원 신고문]',
    '',
    `위치: 강남구 ${dong || '미지정'} 인근 (위도 ${Number(lat).toFixed(6)}, 경도 ${Number(lng).toFixed(6)})`,
    `문제 유형: ${problemTypes.join(', ') || '미분류'}`,
    `위험 대상: ${target}`,
    `발생 시간대: ${timeBand}`,
    `위험도: ${riskLevel}`,
  ];
  if (cumulativeCount) {
    lines.push(`누적 신고 건수: ${cumulativeCount}건 (고위험 지역 자동 격상)`);
  }
  lines.push('', '상세 내용:', detail || '(상세 내용 없음)', '', '요청 조치:');
  (recommendedActions.length ? recommendedActions : ['현장 확인 및 안전 조치']).forEach((a) => lines.push(`- ${a}`));
  lines.push('', '본 민원은 강남구 위험 지도(강남 안전핀) 서비스를 통해 시민 제보를 바탕으로 자동 작성되었습니다. 현장 확인 및 개선 조치를 요청드립니다.');
  return lines.join('\n');
}

function analyzeWithFallback(input) {
  const text = `${input.detail || ''}`;
  const matchedTypes = new Set(input.problemTypes || []);

  for (const { keywords, type } of KEYWORD_MAP) {
    if (keywords.some((kw) => text.includes(kw))) matchedTypes.add(type);
  }
  if (matchedTypes.size === 0 && input.problemTypes) {
    input.problemTypes.forEach((t) => matchedTypes.add(t));
  }

  let target = input.pedestrianType || '보행자';
  if (/학생|학원/.test(text)) target = '학생';
  else if (/노인|어르신|노약자/.test(text)) target = '노약자';
  else if (/운전|차량 운행/.test(text)) target = '운전자';

  let timeBand = input.timeBand || '저녁';
  if (/등교|아침/.test(text)) timeBand = '등교';
  else if (/하교|오후/.test(text)) timeBand = '하교';
  else if (/야간|밤|심야/.test(text)) timeBand = '야간';
  else if (/저녁/.test(text)) timeBand = '저녁';

  let riskLevel = input.riskLevel || '보통';
  if (matchedTypes.size >= 2 || /위험|사고|넘어질|다칠/.test(text)) riskLevel = '높음';

  const problemTypes = Array.from(matchedTypes);
  const recommendedActions = problemTypes.map((t) => ACTION_MAP[t]).filter(Boolean);

  const reportText = buildReportText({ ...input, problemTypes, target, timeBand, riskLevel, recommendedActions });

  return { problemTypes, target, timeBand, riskLevel, recommendedActions, reportText };
}

function buildPrompt(input) {
  return `당신은 강남구 시민 안전 제보를 분석해 공식 민원 신고문을 작성하는 도우미입니다.
아래 시민 제보를 분석해서 JSON 형식으로만 답하세요. 다른 설명은 절대 붙이지 마세요.

[허용된 문제 유형 목록]
${PROBLEM_TYPES.join(', ')}

[허용된 위험 대상]
${TARGETS.join(', ')}

[허용된 시간대]
${TIME_BANDS.join(', ')}

[허용된 위험도]
${RISK_LEVELS.join(', ')}

[시민 제보 내용]
"${input.detail || ''}"

[참고 정보]
- 사용자가 선택한 문제 유형: ${(input.problemTypes || []).join(', ') || '없음'}
- 사용자가 선택한 시간대: ${input.timeBand || '없음'}
- 사용자가 체감한 위험도: ${input.riskLevel || '없음'}
- 보행자 유형: ${input.pedestrianType || '없음'}
- 위치: 강남구 ${input.dong || ''} (위도 ${input.lat}, 경도 ${input.lng})

다음 JSON 스키마로만 응답하세요:
{
  "problemTypes": ["허용된 문제 유형 목록 중에서 선택"],
  "target": "허용된 위험 대상 중 하나",
  "timeBand": "허용된 시간대 중 하나",
  "riskLevel": "허용된 위험도 중 하나",
  "recommendedActions": ["구체적인 개선 조치 문장들"],
  "reportText": "공공기관에 제출 가능한 격식있는 공식 민원 신고문 전체 텍스트 (위치, 문제유형, 상세내용, 요청조치 포함)"
}`;
}

async function analyzeWithClaude(input) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API 오류: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾지 못했습니다');

  const parsed = JSON.parse(jsonMatch[0]);
  return normalizeResult(parsed, input);
}

/**
 * 시민의 자유 서술을 문제유형/위험대상/시간대/위험도/추천조치/공식신고문으로 구조화한다.
 * ANTHROPIC_API_KEY가 없거나 호출이 실패하면 규칙 기반 폴백 분석기를 사용한다.
 */
async function analyzeReport(input) {
  if (ANTHROPIC_API_KEY) {
    try {
      return await analyzeWithClaude(input);
    } catch (err) {
      console.error('[aiService] Claude 분석 실패, 폴백으로 전환:', err.message);
    }
  }
  return analyzeWithFallback(input);
}

module.exports = { analyzeReport, buildReportText, ACTION_MAP };
