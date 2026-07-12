// Converts a validated import payload (see importValidator.js) into the
// { phases, items } shape roadmapStore.createCustomRoadmap expects (issue
// #4). Pure — no DOM, no store, no Firebase — so a future schemaVersion bump
// means adding a new adapter function here, never touching the validator or
// the store. Only ever called on data that has already passed
// validateImportPayload(); it does not re-validate.

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Normalizes any of the three item shapes validateImportPayload() accepts
// (plain string / [title, priority] tuple / { title, priority?, resources? }
// object, issue #100) into { title, priority, resources }. `resources`
// entries were already checked against isValidResourceEntry() in
// importValidator.js (http(s)-only, length-capped) before this ever runs —
// validateImportText() only resolves `data` once valid — so no re-validation
// happens here, matching every other field this function trusts as already
// checked.
function normalizeItem(rawItem, phasePriority) {
  if (typeof rawItem === 'string') {
    return { title: rawItem, priority: phasePriority, resources: [] };
  }
  if (Array.isArray(rawItem)) {
    const [title, priority] = rawItem;
    return { title, priority, resources: [] };
  }
  return {
    title: rawItem.title,
    priority: rawItem.priority || phasePriority,
    resources: (rawItem.resources || []).map(r => ({ label: r.label.trim(), url: r.url }))
  };
}

export function adaptImportToRoadmap(data) {
  const phases = [];
  const items = {};

  data.phases.forEach(phase => {
    const sections = [];
    phase.sections.forEach(section => {
      section.items.forEach(rawItem => {
        const { title, priority, resources } = normalizeItem(rawItem, phase.priority);
        const id = genId('custom');
        items[id] = {
          id,
          title: title.trim(),
          phase: phase.title,
          section: section.title,
          priority,
          done: false,
          custom: true,
          deleted: false,
          resources,
          createdAt: Date.now()
        };
      });
      sections.push({ id: genId('section'), title: section.title });
    });
    phases.push({ id: genId('phase'), title: phase.title, priority: phase.priority, resourceKey: null, sections });
  });

  return { phases, items };
}
