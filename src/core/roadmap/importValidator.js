// Pure validation for AI-import roadmap JSON (issue #4) — no DOM, no store,
// no Firebase. Deliberately decoupled from schemaAdapter.js: bumping
// SUPPORTED_SCHEMA_VERSION and adding a new adapter is how a future schema
// version gets supported, not by editing what "valid" means here.
import { MAX_RESOURCE_LABEL_LENGTH, MAX_RESOURCE_URL_LENGTH } from './limits.js';

// Duplicated from src/ui/dom.js's isValidUrl() rather than imported — this
// module is deliberately DOM/store/Firebase-free (see the doc comment
// above), and ui/dom.js lives in the UI layer. Same http(s)-only check, kept
// in sync by hand; both are tiny and unlikely to drift.
function isHttpUrl(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const MAX_ITEMS = 500;
const MAX_RESOURCES_PER_ITEM = 5;
export const SUPPORTED_SCHEMA_VERSION = 1;

// Many AI assistants wrap JSON output in a fenced code block (```json ... ```)
// even when explicitly told not to — this is the single most common reason a
// pasted payload fails to parse. Strip one leading/trailing fence (with or
// without a `json` language tag) before attempting JSON.parse, and only fall
// through to the "Invalid JSON" error if that still fails.
function stripFencedCodeBlock(rawText) {
  const match = rawText.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return match ? match[1] : rawText;
}

export function parseImportJson(rawText) {
  try {
    return { data: JSON.parse(stripFencedCodeBlock(rawText)), error: null };
  } catch {
    return { data: null, error: 'Invalid JSON — check for missing commas or brackets' };
  }
}

// A resource entry mirrors the app's own { label, url } shape (limits.js's
// isValidResource) — label required and capped, url required, capped, and
// restricted to http(s) (never javascript:/data: — same rule as every other
// place a URL enters the store, roadmap-store.md's "Resource URLs must be
// validated before use").
function isValidResourceEntry(resource) {
  return !!resource && typeof resource === 'object' && !Array.isArray(resource)
    && typeof resource.label === 'string' && resource.label.trim().length > 0
    && resource.label.length <= MAX_RESOURCE_LABEL_LENGTH
    && typeof resource.url === 'string' && resource.url.length <= MAX_RESOURCE_URL_LENGTH
    && isHttpUrl(resource.url);
}

function isValidResourcesField(resources) {
  return resources === undefined
    || (Array.isArray(resources) && resources.length <= MAX_RESOURCES_PER_ITEM && resources.every(isValidResourceEntry));
}

// An item is one of three shapes: a plain string (inherits the phase's
// priority, no resources); a [title, priority] tuple; or an object form
// `{ title, priority?, resources? }` — the only shape that can carry
// resource links, added in issue #100's resources support. `priority` is
// optional on the object form (inherits the phase's priority when omitted),
// matching the plain-string item's existing behavior.
function isValidItem(item) {
  if (typeof item === 'string') return item.trim().length > 0;
  if (Array.isArray(item)) {
    if (item.length !== 2) return false;
    const [title, priority] = item;
    return typeof title === 'string' && title.trim().length > 0 && VALID_PRIORITIES.includes(priority);
  }
  if (item && typeof item === 'object') {
    const titleOk = typeof item.title === 'string' && item.title.trim().length > 0;
    const priorityOk = item.priority === undefined || VALID_PRIORITIES.includes(item.priority);
    return titleOk && priorityOk && isValidResourcesField(item.resources);
  }
  return false;
}

// Returns an array of human-readable error strings — empty means valid.
// Field-level messages include the phases[i].sections[j].items[k] path so a
// user can find the exact spot in their pasted JSON that needs fixing.
export function validateImportPayload(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return ['Invalid JSON — check for missing commas or brackets'];
  }

  const errors = [];

  if (data.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push('Unsupported schema version');
  }
  if (typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('title is required');
  }
  if (!Array.isArray(data.phases) || data.phases.length === 0) {
    errors.push('roadmap must have at least one phase');
    return errors;
  }

  let totalItems = 0;
  data.phases.forEach((phase, i) => {
    if (!phase || typeof phase !== 'object' || Array.isArray(phase)) {
      errors.push(`phases[${i}] is invalid`);
      return;
    }
    if (typeof phase.title !== 'string' || !phase.title.trim()) {
      errors.push(`phases[${i}].title is required`);
    }
    if (!VALID_PRIORITIES.includes(phase.priority)) {
      errors.push(`phases[${i}].priority must be one of ${VALID_PRIORITIES.join(', ')}`);
    }
    if (!Array.isArray(phase.sections) || phase.sections.length === 0) {
      errors.push(`phases[${i}].sections must be a non-empty array`);
      return;
    }
    phase.sections.forEach((section, j) => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        errors.push(`phases[${i}].sections[${j}] is invalid`);
        return;
      }
      if (typeof section.title !== 'string' || !section.title.trim()) {
        errors.push(`phases[${i}].sections[${j}].title is required`);
      }
      if (!Array.isArray(section.items) || section.items.length === 0) {
        errors.push(`phases[${i}].sections[${j}].items must have at least one item`);
        return;
      }
      section.items.forEach((item, k) => {
        if (!isValidItem(item)) {
          errors.push(`item at phases[${i}].sections[${j}].items[${k}] is invalid`);
        } else {
          totalItems += 1;
        }
      });
    });
  });

  if (totalItems > MAX_ITEMS) {
    errors.push(`Roadmap too large (> ${MAX_ITEMS} items)`);
  }

  return errors;
}

// Convenience wrapper combining parse + validate for UI call sites — returns
// `{ valid, errors, data }` where `data` is only set when `valid` is true.
export function validateImportText(rawText) {
  const { data, error } = parseImportJson(rawText);
  if (error) return { valid: false, errors: [error], data: null };
  const errors = validateImportPayload(data);
  return { valid: errors.length === 0, errors, data: errors.length === 0 ? data : null };
}
