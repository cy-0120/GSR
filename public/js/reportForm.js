import { api } from './api.js';
import { getDeviceId } from './device.js';
import { fillSelect, renderChipGroup } from './domHelpers.js';
import { setSelectionMarker, clearSelectionMarker } from './map.js';
import { requestLocation } from './locationPicker.js';
import { showToast } from './toast.js';

const backdrop = document.getElementById('reportModalBackdrop');
const form = document.getElementById('reportForm');
const locationHint = document.getElementById('reportLocationHint');
const errorText = document.getElementById('reportFormError');
const aiPreviewBtn = document.getElementById('aiPreviewBtn');
const aiPreviewResult = document.getElementById('aiPreviewResult');
const submitBtn = document.getElementById('reportSubmitBtn');

let problemTypeChips;
let selectedLocation = null;
let lastAiAnalysis = null;
let onSubmittedCallback = () => {};

export function initReportForm(meta, onSubmitted) {
  onSubmittedCallback = onSubmitted;

  fillSelect(document.getElementById('reportDong'), meta.dongs, '동을 선택하세요');
  fillSelect(document.getElementById('reportTimeBand'), meta.timeBands, '선택');
  fillSelect(document.getElementById('reportRiskLevel'), meta.riskLevels, '선택');
  fillSelect(document.getElementById('reportCongestionLevel'), meta.congestionLevels, '해당 없음');
  fillSelect(document.getElementById('reportPedestrianType'), meta.targets, '선택');
  problemTypeChips = renderChipGroup(document.getElementById('reportProblemTypes'), meta.problemTypes);

  document.getElementById('openReportBtn').addEventListener('click', startLocationPick);
  document.getElementById('reportChangeLocationBtn').addEventListener('click', startLocationPick);
  document.getElementById('reportModalCloseBtn').addEventListener('click', () => closeModal(true));
  document.getElementById('reportCancelBtn').addEventListener('click', () => closeModal(true));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(true); });

  aiPreviewBtn.addEventListener('click', runAiPreview);
  form.addEventListener('submit', handleSubmit);
}

function startLocationPick() {
  backdrop.classList.remove('open');
  requestLocation((lat, lng) => {
    selectedLocation = { lat, lng };
    setSelectionMarker(lat, lng);
    locationHint.firstChild.textContent = `선택된 위치: 위도 ${lat.toFixed(6)}, 경도 ${lng.toFixed(6)} `;
    backdrop.classList.add('open');
  });
}

function closeModal(reset) {
  backdrop.classList.remove('open');
  if (reset) {
    form.reset();
    problemTypeChips.reset();
    selectedLocation = null;
    lastAiAnalysis = null;
    clearSelectionMarker();
    locationHint.firstChild.textContent = '지도를 클릭해 위치를 선택해 주세요. ';
    aiPreviewResult.textContent = '상세 내용을 입력하고 "AI로 분석하기"를 눌러보세요.';
    errorText.textContent = '';
  }
}

function collectFormState() {
  return {
    dong: document.getElementById('reportDong').value,
    detail: document.getElementById('reportDetail').value.trim(),
    problemTypes: problemTypeChips.getSelected(),
    timeBand: document.getElementById('reportTimeBand').value,
    riskLevel: document.getElementById('reportRiskLevel').value,
    congestionLevel: document.getElementById('reportCongestionLevel').value,
    pedestrianType: document.getElementById('reportPedestrianType').value,
  };
}

async function runAiPreview() {
  const state = collectFormState();
  if (!selectedLocation) {
    errorText.textContent = '먼저 지도에서 위치를 선택해 주세요.';
    return;
  }
  if (!state.detail && state.problemTypes.length === 0) {
    errorText.textContent = '상세 내용 또는 문제 유형을 입력해 주세요.';
    return;
  }
  errorText.textContent = '';
  aiPreviewBtn.disabled = true;
  aiPreviewBtn.textContent = '분석 중...';
  aiPreviewResult.textContent = 'AI가 제보 내용을 분석하고 있습니다...';

  try {
    const { analysis } = await api.previewAi({ ...state, ...selectedLocation });
    lastAiAnalysis = analysis;
    aiPreviewResult.innerHTML = formatAnalysis(analysis);
  } catch (err) {
    aiPreviewResult.textContent = `AI 분석에 실패했습니다: ${err.message}`;
  } finally {
    aiPreviewBtn.disabled = false;
    aiPreviewBtn.textContent = 'AI로 분석하기';
  }
}

function formatAnalysis(analysis) {
  const lines = [
    `<strong>문제 유형:</strong> ${analysis.problemTypes.join(', ') || '미분류'}`,
    `<strong>위험 대상:</strong> ${analysis.target}`,
    `<strong>시간대:</strong> ${analysis.timeBand}`,
    `<strong>위험도:</strong> ${analysis.riskLevel}`,
    `<strong>추천 조치:</strong> ${analysis.recommendedActions.join(', ') || '없음'}`,
  ];
  return lines.join('<br/>');
}

async function handleSubmit(e) {
  e.preventDefault();
  const state = collectFormState();

  if (!selectedLocation) {
    errorText.textContent = '지도에서 위치를 선택해 주세요.';
    return;
  }
  if (!state.dong || !state.timeBand || !state.riskLevel || !state.pedestrianType) {
    errorText.textContent = '필수 항목을 모두 선택해 주세요.';
    return;
  }
  if (!state.detail && state.problemTypes.length === 0) {
    errorText.textContent = '문제 유형 또는 상세 내용을 입력해 주세요.';
    return;
  }

  errorText.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '접수 중...';

  try {
    const formData = new FormData();
    formData.set('deviceId', getDeviceId());
    formData.set('lat', selectedLocation.lat);
    formData.set('lng', selectedLocation.lng);
    formData.set('dong', state.dong);
    formData.set('detail', state.detail);
    formData.set('problemTypes', JSON.stringify(state.problemTypes));
    formData.set('timeBand', state.timeBand);
    formData.set('riskLevel', state.riskLevel);
    formData.set('congestionLevel', state.congestionLevel);
    formData.set('pedestrianType', state.pedestrianType);

    const photoFile = document.getElementById('reportPhoto').files[0];
    if (photoFile) formData.set('photo', photoFile);

    const result = await api.createReport(formData);
    showToast('제보가 접수되었습니다. 감사합니다!');
    closeModal(true);
    onSubmittedCallback(result.spot);
  } catch (err) {
    if (err.status === 429) {
      const minutes = Math.ceil((err.payload?.remainingCooldownMs || 0) / 60000);
      errorText.textContent = `같은 장소에 이미 신고 이력이 있습니다. 약 ${minutes}분 후 다시 시도해 주세요.`;
    } else {
      errorText.textContent = err.message || '제보 접수 중 오류가 발생했습니다.';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '제보 접수하기';
  }
}
