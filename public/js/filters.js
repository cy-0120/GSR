const FILTER_GROUPS = [
  { key: 'problemType', label: '문제 유형', metaKey: 'problemTypes' },
  { key: 'risk', label: '위험도', metaKey: 'riskLevels' },
  { key: 'timeBand', label: '시간대', metaKey: 'timeBands' },
  { key: 'target', label: '대상', metaKey: 'targets' },
  { key: 'status', label: '처리 상태', metaKey: 'statuses' },
  { key: 'congestion', label: '혼잡도', metaKey: 'congestionLevels' },
  { key: 'dong', label: '지역', metaKey: 'dongs', searchable: true, placeholder: '동 이름 검색...' },
];

const selected = {};
FILTER_GROUPS.forEach((g) => { selected[g.key] = new Set(); });

export function initFilters(meta, onChange) {
  const container = document.getElementById('filterGroups');
  container.innerHTML = '';

  FILTER_GROUPS.forEach((group) => {
    const wrap = document.createElement('div');
    wrap.className = 'filter-group';

    const title = document.createElement('div');
    title.className = 'filter-group-title';
    title.textContent = group.label;
    wrap.appendChild(title);

    const chipList = document.createElement('div');
    chipList.className = 'filter-chip-list';

    if (group.searchable) {
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'filter-search-input';
      searchInput.placeholder = group.placeholder || '검색...';
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        chipList.querySelectorAll('.chip').forEach((chip) => {
          const match = chip.textContent.toLowerCase().includes(query);
          chip.classList.toggle('hidden', !match);
        });
      });
      wrap.appendChild(searchInput);
    }

    (meta[group.metaKey] || []).forEach((value, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = value;
      if (group.key === 'congestion' && meta.congestionLevelColors?.[i]) {
        chip.style.borderColor = meta.congestionLevelColors[i];
        chip.style.boxShadow = `inset 0 -3px 0 ${meta.congestionLevelColors[i]}`;
      }
      chip.addEventListener('click', () => {
        if (selected[group.key].has(value)) {
          selected[group.key].delete(value);
          chip.classList.remove('active');
        } else {
          selected[group.key].add(value);
          chip.classList.add('active');
        }
        onChange(buildQuery());
        updateSummary();
      });
      chipList.appendChild(chip);
    });

    wrap.appendChild(chipList);
    container.appendChild(wrap);
  });

  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    FILTER_GROUPS.forEach((g) => selected[g.key].clear());
    document.querySelectorAll('#filterGroups .chip.active').forEach((c) => c.classList.remove('active'));
    document.querySelectorAll('#filterGroups .filter-search-input').forEach((input) => { input.value = ''; });
    document.querySelectorAll('#filterGroups .chip.hidden').forEach((c) => c.classList.remove('hidden'));
    onChange(buildQuery());
    updateSummary();
  });

  updateSummary();
}

function buildQuery() {
  const params = new URLSearchParams();
  FILTER_GROUPS.forEach((g) => {
    if (selected[g.key].size) params.set(g.key, Array.from(selected[g.key]).join(','));
  });
  return params.toString();
}

function updateSummary() {
  const total = FILTER_GROUPS.reduce((sum, g) => sum + selected[g.key].size, 0);
  const summary = document.getElementById('filterSummary');
  summary.textContent = total ? `${total}개 필터 적용 중` : '적용된 필터가 없습니다.';
}
