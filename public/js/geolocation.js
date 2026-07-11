/** navigator.geolocation을 Promise 기반으로 감싼다. */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('이 브라우저는 위치 정보를 지원하지 않습니다.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(new Error(describeGeoError(err))),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...options },
    );
  });
}

function describeGeoError(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해 주세요.';
    case err.POSITION_UNAVAILABLE:
      return '현재 위치를 확인할 수 없습니다.';
    case err.TIMEOUT:
      return '위치 확인이 시간 초과되었습니다. 다시 시도해 주세요.';
    default:
      return '위치 확인 중 오류가 발생했습니다.';
  }
}
