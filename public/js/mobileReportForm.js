import { api } from './api.js';
import { getDeviceId } from './device.js';
import { fillSelect, renderChipGroup, renderGradientBar, setupSearchableInput } from './domHelpers.js';
import { getCurrentPosition } from './geolocation.js';
import { setUserLocationMarker, flyTo } from './map.js';
import { showToast } from './toast.js';

const statusBar = document.querySelector('.mobile-location-bar');
const statusEl = document.getElementById('mobileLocationStatus');
const locationSummary = document.getElementById('mobileLocationSummary');
const refreshBtn = document.getElementById('mobileLocationRefreshBtn');
const form = document.getElementById('mobileReportForm');
const errorText = document.getElementById('mobileFormError');
const submitBtn = document.getElementById('mobileSubmitBtn');
const otherInput = document.getElementById('mobileProblemTypeOther');
const photoInput = document.getElementById('mobilePhoto');
const photoPreview = document.getElementById('mobilePhotoPreview');
const photoLabel = document.getElementById('mobilePhotoLabel');
const dongInput = document.getElementById('mobileDong');
const congestionCaption = document.getElementById('mobileCongestionCaption');
const reportPage = document.getElementById('mobileReportFormPage');
const openReportPageBtn = document.getElementById('mobileOpenReportPageBtn');
const backBtn = document.getElementById('mobileReportBackBtn');

let otherProblemType = '기타';
let problemTypeChips;
let congestionBar;
let currentPosition = null;
let onSubmittedCallback = () => {};

export function initMobileReportForm(meta, onSubmitted) {
  onSubmittedCallback = onSubmitted;
  otherProblemType = meta.otherProblemType || '기타';

  setupSearchableInput(dongInput, document.getElementById('mobileDongList'), meta.dongs);
  fillSelect(document.getElementById('mobileTimeBand'), meta.timeBands, '선택 안 함');
  fillSelect(document.getElementById('mobilePedestrianType'), meta.targets, '선택 안 함');

  problemTypeChips = renderChipGroup(document.getElementById('mobileProblemTypes'), meta.problemTypes, {
    onToggle: (value, isActive) => {
      if (value !== otherProblemType) return;
      otherInput.classList.toggle('hidden', !isActive);
      if (isActive) otherInput.focus();
      else otherInput.value = '';
    },
  });

  congestionBar = renderGradientBar(
    document.getElementById('mobileCongestionBar'),
    meta.congestionLevels,
    meta.congestionLevelColors,
    { onSelect: (level) => { congestionCaption.textContent = level; } },
  );
  document.getElementById('mobileCongestionResetBtn').addEventListener('click', () => {
    congestionBar.reset();
    congestionCaption.textContent = '해당 없음';
  });

  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) {
      photoPreview.classList.add('hidden');
      photoLabel.textContent = '📷 사진 촬영';
      return;
    }
    photoPreview.src = URL.createObjectURL(file);
    photoPreview.classList.remove('hidden');
    photoLabel.textContent = '📷 사진 변경';
  });

  refreshBtn.addEventListener('click', requestLocation);
  form.addEventListener('submit', handleSubmit);

  openReportPageBtn.addEventListener('click', () => reportPage.classList.add('open'));
  backBtn.addEventListener('click', () => reportPage.classList.remove('open'));

  requestLocation();
}

async function requestLocation() {
  statusEl.textContent = '📍 위치 확인 중...';
  locationSummary.textContent = '📍 위치 확인 중...';
  statusBar.classList.remove('location-ok', 'location-error');
  submitBtn.disabled = true;
  submitBtn.textContent = '위치 확인 중...';
  openReportPageBtn.disabled = true;

  try {
    const pos = await getCurrentPosition();
    currentPosition = pos;
    statusEl.textContent = `📍 현재 위치 확인됨 (오차범위 ±${Math.round(pos.accuracy)}m)`;
    locationSummary.textContent = '📍 현재 위치 확인됨';
    statusBar.classList.add('location-ok');
    setUserLocationMarker(pos.lat, pos.lng, pos.accuracy);
    flyTo(pos.lat, pos.lng);
    submitBtn.disabled = false;
    submitBtn.textContent = '제보 접수하기';
    openReportPageBtn.disabled = false;

    api.reverseGeocode(pos.lat, pos.lng)
      .then(({ dong }) => {
        if (dong) {
          if (!dongInput.value) dongInput.value = dong;
          statusEl.textContent = `📍 ${dong} 부근 (오차범위 ±${Math.round(pos.accuracy)}m)`;
          locationSummary.textContent = `📍 ${dong} 부근`;
        }
      })
      .catch(() => {});
  } catch (err) {
    currentPosition = null;
    statusEl.textContent = err.message;
    locationSummary.textContent = '📍 위치 확인 필요';
    statusBar.classList.add('location-error');
    submitBtn.disabled = true;
    submitBtn.textContent = '위치 확인 필요';
    openReportPageBtn.disabled = true;
  }
}

function collectFormState() {
  const problemTypes = problemTypeChips.getSelected();
  return {
    dong: dongInput.value.trim(),
    detail: document.getElementById('mobileDetail').value.trim(),
    problemTypes,
    customProblemType: problemTypes.includes(otherProblemType) ? otherInput.value.trim() : '',
    timeBand: document.getElementById('mobileTimeBand').value,
    pedestrianType: document.getElementById('mobilePedestrianType').value,
    congestionLevel: congestionBar.getSelected() || '',
  };
}

function resetFormFields() {
  form.reset();
  problemTypeChips.reset();
  congestionBar.reset();
  congestionCaption.textContent = '해당 없음';
  otherInput.classList.add('hidden');
  otherInput.value = '';
  photoPreview.classList.add('hidden');
  photoPreview.src = '';
  photoLabel.textContent = '📷 사진 촬영';
  errorText.textContent = '';
}

async function handleSubmit(e) {
  e.preventDefault();

  if (!currentPosition) {
    errorText.textContent = '위치를 먼저 확인해 주세요.';
    return;
  }

  const state = collectFormState();
  if (!state.detail && state.problemTypes.length === 0) {
    errorText.textContent = '문제 유형 또는 상세 내용을 입력해 주세요.';
    return;
  }
  if (state.problemTypes.includes(otherProblemType) && !state.customProblemType) {
    errorText.textContent = '"기타"를 선택했다면 어떤 문제인지 직접 입력해 주세요.';
    return;
  }

  errorText.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '접수 중...';

  try {
    const formData = new FormData();
    formData.set('deviceId', getDeviceId());
    formData.set('lat', currentPosition.lat);
    formData.set('lng', currentPosition.lng);
    formData.set('dong', state.dong);
    formData.set('detail', state.detail);
    formData.set('problemTypes', JSON.stringify(state.problemTypes));
    formData.set('customProblemType', state.customProblemType);
    formData.set('timeBand', state.timeBand);
    formData.set('pedestrianType', state.pedestrianType);
    formData.set('congestionLevel', state.congestionLevel);

    const photoFile = photoInput.files[0];
    if (photoFile) formData.set('photo', photoFile);

    const result = await api.createReport(formData);
    showToast('제보가 접수되었습니다. 감사합니다!');
    resetFormFields();
    reportPage.classList.remove('open');
    onSubmittedCallback(result.spot);
  } catch (err) {
    if (err.status === 429) {
      const minutes = Math.ceil((err.payload?.remainingCooldownMs || 0) / 60000);
      errorText.textContent = `같은 장소에 이미 신고 이력이 있습니다. 약 ${minutes}분 후 다시 시도해 주세요.`;
    } else {
      errorText.textContent = err.message || '제보 접수 중 오류가 발생했습니다.';
    }
  } finally {
    submitBtn.disabled = !currentPosition;
    submitBtn.textContent = '제보 접수하기';
  }
}
