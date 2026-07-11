import { onMapClick } from './map.js';
import { showToast } from './toast.js';

const mapEl = document.getElementById('map');
let activeCallback = null;

onMapClick((lat, lng) => {
  if (!activeCallback) return;
  const callback = activeCallback;
  activeCallback = null;
  mapEl.style.cursor = '';
  callback(lat, lng);
});

export function isPicking() {
  return activeCallback !== null;
}

export function requestLocation(callback) {
  activeCallback = callback;
  mapEl.style.cursor = 'crosshair';
  showToast('지도를 클릭해 위치를 선택해 주세요.');
}

export function cancelLocationRequest() {
  activeCallback = null;
  mapEl.style.cursor = '';
}
