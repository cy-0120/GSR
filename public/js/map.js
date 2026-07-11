const GANGNAM_CENTER = [37.5172, 127.0473];

const PIN_COLORS = {
  red: '#ef4444',
  orange: '#f59e0b',
  yellow: '#eab308',
  blue: '#3b82f6',
  green: '#22c55e',
};

let map;
let markerLayer;
let selectionMarker;
let userLocationMarker;
let userLocationAccuracyCircle;
let clickHandlers = [];

export function initMap() {
  map = L.map('map', { zoomControl: true }).setView(GANGNAM_CENTER, 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  map.on('click', (e) => {
    clickHandlers.forEach((handler) => handler(e.latlng.lat, e.latlng.lng));
  });

  return map;
}

export function onMapClick(handler) {
  clickHandlers.push(handler);
}

export function setSelectionMarker(lat, lng) {
  if (selectionMarker) map.removeLayer(selectionMarker);
  selectionMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'selection-marker',
      html: '<div style="font-size:26px;line-height:1;">📍</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    }),
  }).addTo(map);
}

export function clearSelectionMarker() {
  if (selectionMarker) {
    map.removeLayer(selectionMarker);
    selectionMarker = null;
  }
}

export function renderSpots(spots, onSelect) {
  markerLayer.clearLayers();
  spots.forEach((spot) => {
    const color = PIN_COLORS[spot.pinColor] || PIN_COLORS.yellow;
    const marker = L.circleMarker([spot.lat, spot.lng], {
      radius: 10,
      color: '#0b1017',
      weight: 2,
      fillColor: color,
      fillOpacity: 0.9,
    });
    marker.on('click', () => onSelect(spot.id));
    marker.bindTooltip(`${spot.dong || ''} · ${spot.status} (${spot.issueCount}건)`, { direction: 'top' });
    marker.addTo(markerLayer);
  });
}

export function flyTo(lat, lng) {
  map.flyTo([lat, lng], Math.max(map.getZoom(), 16));
}

/** GPS로 확인한 사용자의 현재 위치를 지도에 파란 점 + 정확도 원으로 표시한다. */
export function setUserLocationMarker(lat, lng, accuracy) {
  if (userLocationMarker) map.removeLayer(userLocationMarker);
  if (userLocationAccuracyCircle) map.removeLayer(userLocationAccuracyCircle);

  userLocationMarker = L.circleMarker([lat, lng], {
    radius: 8,
    color: '#ffffff',
    weight: 3,
    fillColor: '#3aa0ff',
    fillOpacity: 1,
  }).addTo(map);

  if (accuracy) {
    userLocationAccuracyCircle = L.circle([lat, lng], {
      radius: accuracy,
      color: '#3aa0ff',
      weight: 1,
      fillColor: '#3aa0ff',
      fillOpacity: 0.12,
    }).addTo(map);
  }
}

export function invalidateMapSize() {
  if (map) map.invalidateSize();
}
