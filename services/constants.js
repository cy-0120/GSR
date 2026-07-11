// 세부 유형을 카테고리 단위로 묶어 선택지를 줄이고, 목록에 없는 문제는 "기타"로 직접 입력한다.
const PROBLEM_TYPES = [
  '도로·보도 파손',
  '시설물 노후·고장',
  '안전 사각지대',
  '통행 방해물',
  '보행자 위험 요소',
  '혼잡',
  '기타',
];

const OTHER_PROBLEM_TYPE = '기타';

const RISK_LEVELS = ['낮음', '보통', '높음', '매우 높음'];

const TIME_BANDS = ['등교', '하교', '저녁', '야간'];

const TARGETS = ['학생', '시민', '노약자', '운전자', '보행자'];

const STATUSES = ['접수됨', '확인 필요', '신고문 생성', '공식 신고 완료', '해결됨'];

// 혼잡도는 그라데이션 바 형태로 5단계 표시 (녹색 → 빨강)
const CONGESTION_LEVELS = ['매우 한산', '한산', '보통', '혼잡', '매우 혼잡'];
const CONGESTION_LEVEL_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

const CONGESTION_TIME_BANDS = [
  '평일 아침 07:30~09:00',
  '평일 오후 15:00~17:00',
  '학원 종료 시간 21:00~23:00',
  '주말 오후',
  '행사/시험 기간',
];

const DONGS = [
  '신사동', '논현동', '압구정동', '청담동', '삼성동',
  '대치동', '역삼동', '도곡동', '개포동', '일원동', '수서동', '세곡동',
];

// 반경 10m 이내 신고는 하나의 위험 스팟으로 자동 그룹화
const CLUSTER_RADIUS_METERS = 10;

// 동일 디바이스가 같은 장소(스팟)에 다시 신고할 수 없는 최소 대기 시간
const ABUSE_COOLDOWN_MS = 60 * 60 * 1000;

// 이 횟수만큼 신고가 누적되면 고위험 지역으로 자동 격상
const ESCALATION_THRESHOLD = 5;

const OFFICIAL_CHANNELS = [
  { key: 'safety_report', label: '안전신문고로 신고하기', url: 'https://www.safetyreport.go.kr' },
  { key: 'seoul_eungdapso', label: '서울시 응답소로 신고하기', url: 'https://eungdapso.seoul.go.kr' },
  { key: 'dasan_120', label: '120다산콜로 연결하기', url: 'https://dasan.seoul.go.kr' },
  { key: 'gangnam_gu', label: '강남구청 민원으로 이동', url: 'https://www.gangnam.go.kr/minwon/main.do' },
];

module.exports = {
  PROBLEM_TYPES,
  OTHER_PROBLEM_TYPE,
  RISK_LEVELS,
  TIME_BANDS,
  TARGETS,
  STATUSES,
  CONGESTION_LEVELS,
  CONGESTION_LEVEL_COLORS,
  CONGESTION_TIME_BANDS,
  DONGS,
  CLUSTER_RADIUS_METERS,
  ABUSE_COOLDOWN_MS,
  ESCALATION_THRESHOLD,
  OFFICIAL_CHANNELS,
};
