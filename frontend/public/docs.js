// Docs view — fetches docs.md once and renders it with the same marked +
// .markdown-body pipeline the editor preview uses. editor.js calls loadDocs()
// the first time the Docs tab opens; the result is cached so repeat visits are
// instant. A failed fetch clears the cache flag so the next visit retries.

const loadDocs = (() => {
  const el = document.getElementById('docs-content');
  let loaded = false;

  return async function loadDocs() {
    if (loaded) return;
    loaded = true;

    try {
      const res = await fetch('docs.md');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      el.innerHTML = marked.parse(await res.text());
    } catch (err) {
      loaded = false; // allow a retry the next time the tab is opened
      el.innerHTML = `<p class="docs-error">Couldn't load the docs (${err.message}).</p>`;
    }
  };
})();
