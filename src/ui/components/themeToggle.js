import { el } from '../dom.js';
import { toggleTheme, getTheme, onThemeChange } from '../../services/theme.js';

const ICONS = { dark: '☀', light: '☾' };

export function createThemeToggle() {
  const btn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon theme-toggle',
    'aria-label': 'Toggle dark mode',
    text: ICONS[getTheme()] || ICONS.light,
    onClick: toggleTheme
  });
  onThemeChange(theme => {
    btn.textContent = ICONS[theme] || ICONS.light;
  });
  return btn;
}
