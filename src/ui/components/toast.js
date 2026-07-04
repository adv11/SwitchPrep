let root;

function ensureRoot() {
  if (!root) {
    root = document.createElement('div');
    root.className = 'toast-stack';
    document.body.appendChild(root);
  }
  return root;
}

export function showToast(message, type = 'info', duration = 3200) {
  const stack = ensureRoot();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 260);
  }, duration);
}
