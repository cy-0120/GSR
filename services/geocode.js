const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * GPS 좌표를 강남구 동 이름으로 역지오코딩한다.
 * OpenStreetMap Nominatim(무료, 키 불필요)을 사용하며 사용량 정책상 개인용 데모 수준의 호출만 가정한다.
 */
async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ko`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'gangnam-safety-pin-prototype (hackathon demo)' },
  });

  if (!response.ok) {
    throw new Error(`Nominatim 오류: ${response.status}`);
  }

  const data = await response.json();
  const addr = data.address || {};
  const dong = addr.neighbourhood || addr.suburb || addr.quarter || addr.village || addr.town || null;

  return { dong, displayName: data.display_name || null };
}

module.exports = { reverseGeocode };
