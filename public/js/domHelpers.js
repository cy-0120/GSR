export function fillSelect(selectEl, values, placeholder) {
  selectEl.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    selectEl.appendChild(opt);
  }
  values.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    selectEl.appendChild(opt);
  });
}

export function renderChipGroup(container, values, { multi = true, onToggle } = {}) {
  container.innerHTML = '';
  const selected = new Set();

  values.forEach((value) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = value;
    chip.addEventListener('click', () => {
      if (!multi) {
        selected.clear();
        container.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      }
      if (selected.has(value)) {
        selected.delete(value);
        chip.classList.remove('active');
      } else {
        selected.add(value);
        chip.classList.add('active');
      }
      if (onToggle) onToggle(value, chip.classList.contains('active'));
    });
    container.appendChild(chip);
  });

  return {
    getSelected: () => Array.from(selected),
    reset: () => {
      selected.clear();
      container.querySelectorAll('.chip.active').forEach((c) => c.classList.remove('active'));
    },
  };
}

/** 5단계 혼잡도 등을 좌→우 그라데이션 막대에서 한 단계 선택하는 컴포넌트 */
export function renderGradientBar(container, levels, colors, { onSelect } = {}) {
  container.innerHTML = '';
  let selected = null;
  const segments = [];

  levels.forEach((level, i) => {
    const seg = document.createElement('button');
    seg.type = 'button';
    seg.className = 'gradient-segment';
    seg.style.background = colors[i] || '#888';
    seg.title = level;
    seg.setAttribute('aria-label', level);
    seg.addEventListener('click', () => {
      selected = level;
      segments.forEach((s) => s.classList.remove('active'));
      seg.classList.add('active');
      if (onSelect) onSelect(level);
    });
    segments.push(seg);
    container.appendChild(seg);
  });

  return {
    getSelected: () => selected,
    setSelected: (level) => {
      selected = level;
      segments.forEach((s, i) => s.classList.toggle('active', levels[i] === level));
    },
    reset: () => {
      selected = null;
      segments.forEach((s) => s.classList.remove('active'));
    },
  };
}

/** <input list="..."> + <datalist>을 이용해 검색 가능한 지역 선택 입력을 구성 */
export function setupSearchableInput(inputEl, datalistEl, values) {
  datalistEl.innerHTML = '';
  values.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    datalistEl.appendChild(opt);
  });
}
