export const KEYS = {
  THEME: 'ascent-theme',
  ROADMAP: 'ascent-roadmap-v3',
  UI_STATE: 'ascent-ui-v3'
};

export function verifyDismissedKey(uid) {
  return `ascent-verify-dismissed-${uid}`;
}
