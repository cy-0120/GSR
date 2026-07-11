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

export function renderChipGroup(container, values, { multi = true } = {}) {
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
