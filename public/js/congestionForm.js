import { api } from './api.js';
import { getDeviceId } from './device.js';
import { fillSelect, renderChipGroup } from './domHelpers.js';
import { setSelectionMarker, clearSelectionMarker } from './map.js';
import { requestLocation } from './locationPicker.js';
import { showToast } from './toast.js';

const backdrop = document.getElementById('congestionModalBackdrop');
const form = document.getElementById('congestionForm');
const locationHint = document.getElementById('congestionLocationHint');
const errorText = document.getElementById('congestionFormError');
const submitBtn = form.querySelector('button[type="submit"]');

let levelChips;
let selectedLocation = null;
let onSubmittedCallback = () => {};

export function initCongestionForm(meta, onSubmitted) {
  onSubmittedCallback = onSubmitted;

  fillSelect(document.getElementById('congestionDong'), meta.dongs, '동을 선택하세요');
  fillSelect(document.getElementById('congestionTimeBand'), meta.congestionTimeBands, '시간대를 선택하세요');
  levelChips = renderChipGroup(document.getElementById('congestionLevelGroup'), meta.congestionLevels, { multi: false });

  document.getElementById('openCongestionBtn').addEventListener('click', startLocationPick);
  document.getElementById('congestionChangeLocationBtn').addEventListener('click', startLocationPick);
  document.getElementById('congestionModalCloseBtn').addEventListener('click', () => closeModal(true));
  document.getElementById('congestionCancelBtn').addEventListener('click', () => closeModal(true));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(true); });

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
    levelChips.reset();
    selectedLocation = null;
    clearSelectionMarker();
    locationHint.firstChild.textContent = '지도를 클릭해 위치를 선택해 주세요. ';
    errorText.textContent = '';
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const dong = document.getElementById('congestionDong').value;
  const congestionTimeBand = document.getElementById('congestionTimeBand').value;
  const [congestionLevel] = levelChips.getSelected();

  if (!selectedLocation) {
    errorText.textContent = '지도에서 위치를 선택해 주세요.';
    return;
  }
  if (!dong || !congestionTimeBand || !congestionLevel) {
    errorText.textContent = '지역, 혼잡 시간, 혼잡도를 모두 선택해 주세요.';
    return;
  }

  errorText.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '제보 중...';

  try {
    const result = await api.createCongestion({
      deviceId: getDeviceId(),
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      dong,
      congestionTimeBand,
      congestionLevel,
    });
    showToast('혼잡도 제보가 접수되었습니다.');
    closeModal(true);
    onSubmittedCallback(result.spot);
  } catch (err) {
    if (err.status === 429) {
      const minutes = Math.ceil((err.payload?.remainingCooldownMs || 0) / 60000);
      errorText.textContent = `같은 장소에 이미 제보 이력이 있습니다. 약 ${minutes}분 후 다시 시도해 주세요.`;
    } else {
      errorText.textContent = err.message || '제보 처리 중 오류가 발생했습니다.';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '혼잡도 제보하기';
  }
}
