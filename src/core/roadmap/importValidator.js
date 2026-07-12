// Pure validation for AI-import roadmap JSON (issue #4) — no DOM, no store,
// no Firebase. Deliberately decoupled from schemaAdapter.js: bumping
// SUPPORTED_SCHEMA_VERSION and adding a new adapter is how a future schema
// version gets supported, not by editing what "valid" means here.
import { MAX_RESOURCE_LABEL_LENGTH, MAX_RESOURCE_URL_LENGTH } from './limits.js';

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

// LLM output is real-world-messy in small, harmless ways ("p0" instead of
// "P0", a trailing space) that shouldn't fail an otherwise-good roadmap —
// normalize before comparing against VALID_PRIORITIES rather than rejecting
// on the raw value. Exported so schemaAdapter.js can apply the exact same
// normalization when it re-reads a field this function already accepted.
export function normalizePriority(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

// A resource entry mirrors the app's own { label, url } shape (limits.js's
// isValidResource) — label required and capped, url required and capped.
// Deliberately **not** checking the URL's protocol here — that's a save-time
// concern (roadmap-store.md's "Resource URLs must be validated before use"
// already applies it at both render time and save time), handled by
// schemaAdapter.js's normalizeResourceUrl()/isHttpUrl() when the item is
// actually converted. Rejecting a whole topic here because one resource's
// URL was missing "https://" (a very common, harmless LLM quirk — see issue
// #100 follow-up) was cascading into "item is invalid" errors across
// otherwise-perfectly-good roadmaps; the adapter now auto-corrects or
// silently drops a bad individual resource instead of failing the item.
function isValidResourceEntry(resource) {
  return !!resource && typeof resource === 'object' && !Array.isArray(resource)
    && typeof resource.label === 'string' && resource.label.trim().length > 0
    && resource.label.length <= MAX_RESOURCE_LABEL_LENGTH
    && typeof resource.url === 'string' && resource.url.trim().length > 0
    && resource.url.length <= MAX_RESOURCE_URL_LENGTH;
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
// matching the plain-string item's existing behavior. Priority values are
// normalized (trim + uppercase) before the VALID_PRIORITIES check.
function isValidItem(item) {
  if (typeof item === 'string') return item.trim().length > 0;
  if (Array.isArray(item)) {
    if (item.length !== 2) return false;
    const [title, priority] = item;
    return typeof title === 'string' && title.trim().length > 0 && VALID_PRIORITIES.includes(normalizePriority(priority));
  }
  if (item && typeof item === 'object') {
    const titleOk = typeof item.title === 'string' && item.title.trim().length > 0;
    const priorityOk = item.priority === undefined || VALID_PRIORITIES.includes(normalizePriority(item.priority));
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
    if (!VALID_PRIORITIES.includes(normalizePriority(phase.priority))) {
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
