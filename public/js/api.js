async function request(path, options = {}) {
  const res = await fetch(path, options);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    const error = new Error((data && data.error) || `요청 실패 (${res.status})`);
    error.status = res.status;
    error.payload = data;
    throw error;
  }
  return data;
}

function json(body) {
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

export const api = {
  getMeta: () => request('/api/meta'),
  getSpots: (query = '') => request(`/api/spots${query ? `?${query}` : ''}`),
  getSpot: (id) => request(`/api/spots/${id}`),
  createReport: (formData) => request('/api/reports', { method: 'POST', body: formData }),
  createCongestion: (body) => request('/api/congestion', { method: 'POST', ...json(body) }),
  previewAi: (body) => request('/api/ai/preview', { method: 'POST', ...json(body) }),
  recordComplaint: (id, body) => request(`/api/spots/${id}/complaint`, { method: 'POST', ...json(body) }),
  updateStatus: (id, status) => request(`/api/spots/${id}/status`, { method: 'PATCH', ...json({ status }) }),
  reverseGeocode: (lat, lng) => request(`/api/geocode/reverse?lat=${lat}&lng=${lng}`),
};
