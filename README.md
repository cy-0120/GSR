# 강남 안전핀 (Gangnam Safety Pin)

강남구 위험 지도 — 시민 제보 기반 안전 플랫폼. Node.js(Express) + SQLite + Leaflet(OpenStreetMap)으로 만든 프로토타입입니다.

## 핵심 기능

- **공간 클러스터링**: GPS 오차를 고려해 반경 10m 이내 신고를 하나의 위험 스팟으로 자동 그룹화합니다. ([services/clustering.js](services/clustering.js))
- **5회 누적 자동 격상**: 스팟에 이슈 제보가 5건 이상 쌓이면 고위험 지역으로 자동 격상되고, AI가 누적된 제보를 종합해 공식 민원 신고문을 자동 생성합니다. 신고문은 개발자/운영자가 확인 후 안전신문고·서울시 응답소·120다산콜·강남구청에 직접 접수하는 방식입니다. ([services/escalation.js](services/escalation.js))
- **어뷰징 방지**: 동일 디바이스가 같은 장소(반경 10m)에 1시간 이내 재신고하는 것을 차단합니다. ([services/abuseGuard.js](services/abuseGuard.js))
- **지도 기반 문제 제보**: 지도를 클릭해 위치를 선택하고 문제 유형·상세 내용·사진(선택)·시간대·위험도 체감·혼잡 여부·보행자 유형을 입력해 제보합니다.
- **AI 분석**: 자유 서술형 제보 내용을 문제 유형/위험 대상/시간대/위험도/추천 조치/공식 신고문으로 자동 구조화합니다. `ANTHROPIC_API_KEY`가 설정되어 있으면 Claude API를 사용하고, 없으면 규칙 기반 폴백 분석기가 동작해 키 없이도 데모가 가능합니다. ([services/aiService.js](services/aiService.js))
- **필터 중심 안전지도**: 문제 유형/위험도/시간대/대상/처리 상태/혼잡도/지역(동) 필터로 지도 핀을 좁혀볼 수 있습니다.
- **혼잡도 조사**: 장소를 선택해 혼잡 시간대(평일 아침/오후, 학원 종료 시간, 주말 오후, 행사·시험 기간)와 혼잡도를 제보하는 별도의 가벼운 폼을 제공합니다.
- **공식 민원 연결**: 신고문 복사, 안전신문고/서울시 응답소/120다산콜/강남구청 링크 이동, 민원번호 기록 기능을 제공합니다.

## 기술 스택

- Backend: Node.js, Express, better-sqlite3 (파일 기반 DB, 별도 설치 불필요)
- Frontend: 순수 JS(ES Modules) + Leaflet.js + OpenStreetMap 타일 (지도 API 키 불필요)
- AI: Anthropic Claude API (선택) + 키워드 기반 폴백 분석기

## 시작하기

```bash
npm install
cp .env.example .env   # 필요하면 ANTHROPIC_API_KEY 입력
npm start
```

`http://localhost:3000` 접속. `data/` 폴더에 SQLite 파일이 자동 생성됩니다.

개발 중에는 `npm run dev`(Node 파일 변경 감지)를 사용할 수 있습니다.

### 환경 변수

| 변수 | 설명 |
|---|---|
| `PORT` | 서버 포트 (기본 3000) |
| `ANTHROPIC_API_KEY` | 설정 시 Claude API로 제보 분석. 비워두면 규칙 기반 폴백 사용 |
| `ANTHROPIC_MODEL` | 사용할 Claude 모델 (기본 `claude-haiku-4-5-20251001`) |

## 프로젝트 구조

```text
server.js               앱 진입점
config/db.js             SQLite 연결 및 스키마 초기화
db/schema.sql            reports / spots 테이블 스키마
services/
  constants.js            문제유형·위험도·필터 등 공유 상수
  geo.js                  Haversine 거리 계산
  clustering.js           반경 10m 공간 클러스터링
  abuseGuard.js           1시간 쿨타임 어뷰징 방지
  aiService.js            AI 분석 (Claude API + 폴백)
  escalation.js           5회 누적 자동 격상
  spotAggregate.js         스팟 집계(위험도/핀색상/필터 매칭)
routes/
  meta.js                 프론트엔드용 상수 API
  spots.js                 스팟 목록/상세/민원기록/상태변경
  reports.js               문제 제보 접수 (사진 업로드 포함)
  congestion.js             혼잡도 제보 접수
  ai.js                     AI 분석 미리보기
public/
  index.html, css/, js/    프론트엔드 (Leaflet 지도, 필터, 제보 폼)
  uploads/                 업로드된 제보 사진
```

## 핀 색상

| 색상 | 의미 |
|---|---|
| 🔴 빨강 | 위험도 높음/매우 높음 |
| 🟠 주황 | 위험도 보통 (주의 필요) |
| 🟡 노랑 | 위험도 낮음 (확인 필요) |
| 🔵 파랑 | 혼잡 정보만 있는 스팟 |
| 🟢 초록 | 처리 상태가 "해결됨" |

## 참고 사항

- 공공기관 민원 처리 상태 API 연동은 프로토타입 범위를 벗어나므로, 이 서비스는 민원을 대리 접수하지 않고 **AI가 신고문을 생성 → 사용자가 확인 → 공식 채널로 이동**하는 흐름으로 설계했습니다.
- 지도는 별도 API 키가 필요 없는 Leaflet + OpenStreetMap을 사용합니다.
- 처리 상태(접수됨 → 확인 필요 → 신고문 생성 → 공식 신고 완료 → 해결됨) 변경은 상세 패널에서 수동으로 할 수 있습니다.
