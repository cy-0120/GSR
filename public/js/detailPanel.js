import { api } from './api.js';
import { showToast } from './toast.js';

const panel = document.getElementById('detailPanel');
const content = document.getElementById('detailContent');
let currentSpotId = null;
let officialChannels = [];

export function initDetailPanel() {
  document.getElementById('detailCloseBtn').addEventListener('click', closeDetail);
}

export function closeDetail() {
  panel.classList.remove('open');
  currentSpotId = null;
}

export async function showSpotDetail(spotId) {
  currentSpotId = spotId;
  panel.classList.add('open');
  content.innerHTML = '<p>불러오는 중...</p>';

  try {
    const { spot, officialChannels: channels } = await api.getSpot(spotId);
    officialChannels = channels;
    if (currentSpotId === spotId) render(spot);
  } catch (err) {
    content.innerHTML = `<p class="error-text">상세 정보를 불러오지 못했습니다: ${err.message}</p>`;
  }
}

function formatDateTime(value) {
  if (!value) return '';
  return `${value.replace('T', ' ')} UTC`;
}

function getDisplayReportText(spot) {
  if (spot.ai_report_text) return { text: spot.ai_report_text, escalated: true };
  const withText = [...spot.reports].reverse().find((r) => r.kind === 'issue' && r.ai_report_text);
  if (withText) return { text: withText.ai_report_text, escalated: false };
  return null;
}

function render(spot) {
  const reportTextInfo = getDisplayReportText(spot);
  const issueReports = spot.reports.filter((r) => r.kind === 'issue');
  const congestionEntries = Object.entries(spot.congestionByTimeBand || {});

  content.innerHTML = `
    <h3 class="detail-title">강남구 ${spot.dong || '위치 미지정'} 위험 스팟 #${spot.id}</h3>
    <p class="detail-sub">위도 ${spot.lat.toFixed(6)}, 경도 ${spot.lng.toFixed(6)} · 누적 제보 ${spot.issueCount + spot.congestionSubmissionCount}건</p>

    ${spot.escalated ? '<div class="escalation-banner">누적 신고 5건 이상 · 고위험 지역으로 자동 격상됨</div>' : ''}

    <div class="badge-row">
      <span class="badge risk-${spot.highestRisk}">위험도: ${spot.highestRisk}</span>
      <span class="badge">상태: ${spot.status}</span>
      <span class="badge">이슈 ${spot.issueCount}건 · 혼잡제보 ${spot.congestionSubmissionCount}건</span>
    </div>

    <div class="detail-section">
      <h4>문제 유형</h4>
      <p>${spot.problemTypes.join(', ') || '등록된 문제 유형 없음'}</p>
    </div>

    <div class="detail-section">
      <h4>혼잡 시간대별 제보</h4>
      ${congestionEntries.length
        ? congestionEntries.map(([band, levels]) => `<p>${band}: ${levels.join(', ')}</p>`).join('')
        : '<p>등록된 혼잡도 제보가 없습니다.</p>'}
    </div>

    <div class="detail-section">
      <h4>개별 제보 내역 (${issueReports.length}건)</h4>
      ${issueReports.length ? issueReports.map(reportCardHtml).join('') : '<p>등록된 문제 제보가 없습니다.</p>'}
    </div>

    <div class="detail-section">
      <h4>AI 추천 조치</h4>
      <p>${JSON.parse(spot.ai_recommended_actions || '[]').join(', ') || issueReports.flatMap(r => JSON.parse(r.ai_recommended_actions || '[]')).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || '아직 없음'}</p>
    </div>

    <div class="detail-section">
      <h4>AI 공식 신고문</h4>
      ${reportTextInfo
        ? `<div class="official-report-box" id="officialReportBox">${escapeHtml(reportTextInfo.text)}</div>
           <div class="channel-buttons">
             <button class="btn btn-secondary" id="copyReportBtn">신고문 복사하기</button>
             ${officialChannels.map((c) => `<a class="btn btn-primary" href="${c.url}" target="_blank" rel="noopener">${c.label}</a>`).join('')}
           </div>`
        : '<p>아직 AI 신고문이 생성되지 않았습니다. 제보를 등록하면 자동 생성됩니다.</p>'}
    </div>

    <div class="detail-section">
      <h4>민원번호 기록</h4>
      <div class="complaint-form">
        <select id="complaintChannel">
          ${officialChannels.map((c) => `<option value="${c.key}">${c.label.replace('로 신고하기', '').replace('으로 이동', '')}</option>`).join('')}
        </select>
        <input type="text" id="complaintNumberInput" placeholder="민원번호" value="${spot.complaint_number || ''}" />
        <button class="btn btn-secondary" id="saveComplaintBtn">저장</button>
      </div>
    </div>

    <div class="detail-section">
      <h4>처리 상태 변경</h4>
      <select class="status-select" id="statusSelect">
        ${['접수됨', '확인 필요', '신고문 생성', '공식 신고 완료', '해결됨'].map((s) => `<option value="${s}" ${s === spot.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
  `;

  const copyBtn = document.getElementById('copyReportBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(reportTextInfo.text);
      showToast('신고문을 클립보드에 복사했습니다.');
    });
  }

  document.getElementById('saveComplaintBtn').addEventListener('click', async () => {
    const complaintNumber = document.getElementById('complaintNumberInput').value.trim();
    const channel = document.getElementById('complaintChannel').value;
    try {
      const { spot: updated } = await api.recordComplaint(spot.id, { complaintNumber, channel });
      showToast('민원번호를 기록했습니다.');
      render(updated);
    } catch (err) {
      showToast(`저장 실패: ${err.message}`);
    }
  });

  document.getElementById('statusSelect').addEventListener('change', async (e) => {
    try {
      const { spot: updated } = await api.updateStatus(spot.id, e.target.value);
      showToast(`상태가 "${e.target.value}"(으)로 변경되었습니다.`);
      render(updated);
    } catch (err) {
      showToast(`변경 실패: ${err.message}`);
    }
  });
}

function reportCardHtml(r) {
  const aiTypes = JSON.parse(r.ai_problem_types || '[]');
  const userTypes = JSON.parse(r.problem_types || '[]');
  const types = (aiTypes.length ? aiTypes : userTypes).slice();
  if (r.custom_problem_type && !types.includes(r.custom_problem_type)) types.push(r.custom_problem_type);
  return `
    <div class="report-card">
      <div>${r.detail ? escapeHtml(r.detail) : '(상세 내용 없음)'}</div>
      <div class="meta">문제유형: ${types.join(', ') || '미분류'} · 시간대: ${r.ai_time_band || r.time_band || '-'} · 위험도(AI 자동판정): ${r.ai_risk_level || r.risk_level || '-'}</div>
      ${r.congestion_level ? `<div class="meta">혼잡도: ${r.congestion_level}</div>` : ''}
      <div class="meta">등록: ${formatDateTime(r.created_at)}</div>
      ${r.photo_path ? `<img src="${r.photo_path}" alt="제보 사진" />` : ''}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
