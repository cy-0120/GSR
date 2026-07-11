import { api } from './api.js';
import { initMap, renderSpots, flyTo, invalidateMapSize } from './map.js';
import { initFilters } from './filters.js';
import { initReportForm } from './reportForm.js';
import { initCongestionForm } from './congestionForm.js';
import { initMobileReportForm } from './mobileReportForm.js';
import { initDetailPanel, showSpotDetail } from './detailPanel.js';
import { showToast } from './toast.js';

async function refreshSpots(query = '') {
  try {
    const { spots } = await api.getSpots(query);
    renderSpots(spots, (spotId) => showSpotDetail(spotId));
  } catch (err) {
    showToast(`지도 데이터를 불러오지 못했습니다: ${err.message}`);
  }
}

async function bootstrap() {
  initMap();
  initDetailPanel();

  const meta = await api.getMeta();

  initFilters(meta, (query) => refreshSpots(query));
  initReportForm(meta, (spot) => {
    refreshSpots();
    flyTo(spot.lat, spot.lng);
    showSpotDetail(spot.id);
  });
  initCongestionForm(meta, (spot) => {
    refreshSpots();
    flyTo(spot.lat, spot.lng);
  });
  initMobileReportForm(meta, (spot) => {
    refreshSpots();
    flyTo(spot.lat, spot.lng);
    showSpotDetail(spot.id);
  });

  const filterPanel = document.getElementById('filterPanel');
  const filterBackdrop = document.getElementById('filterBackdrop');
  const setFilterOpen = (open) => {
    filterPanel.classList.toggle('open', open);
    filterBackdrop.classList.toggle('open', open);
  };
  document.getElementById('toggleFilterBtn').addEventListener('click', () => {
    setFilterOpen(!filterPanel.classList.contains('open'));
  });
  document.getElementById('filterCloseBtn').addEventListener('click', () => setFilterOpen(false));
  filterBackdrop.addEventListener('click', () => setFilterOpen(false));

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(invalidateMapSize, 150);
  });

  await refreshSpots();
}

bootstrap().catch((err) => {
  console.error(err);
  showToast(`초기화 중 오류가 발생했습니다: ${err.message}`);
});
