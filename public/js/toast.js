const toastEl = document.getElementById('toast');
let hideTimer = null;

export function showToast(message, duration = 2600) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}
