'use strict';
(() => {
  const link = document.getElementById('task-editor-link');
  const dialog = document.getElementById('editor-unavailable');
  const url = window.TASK_EDITOR_CONFIG?.url || '';
  let configured = false;
  try {
    const parsed = new URL(url);
    configured = parsed.protocol === 'https:' && parsed.hostname === 'script.google.com' && /^\/macros\/s\/[\w-]+\/exec$/.test(parsed.pathname) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
    if (configured) link.href = parsed.href;
  } catch { /* Unconfigured deployments keep viewing fully functional. */ }
  link.addEventListener('click', event => { if (!configured) { event.preventDefault();dialog.showModal(); } });
  document.getElementById('close-editor-unavailable').addEventListener('click', () => dialog.close());
})();
