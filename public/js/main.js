import { api } from './api.js';
import { initMap, renderSpots, flyTo } from './map.js';
import { initFilters } from './filters.js';
import { initReportForm } from './reportForm.js';
import { initCongestionForm } from './congestionForm.js';
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

  const filterPanel = document.getElementById('filterPanel');
  document.getElementById('toggleFilterBtn').addEventListener('click', () => {
    filterPanel.classList.toggle('open');
  });

  await refreshSpots();
}

bootstrap().catch((err) => {
  console.error(err);
  showToast(`초기화 중 오류가 발생했습니다: ${err.message}`);
});
