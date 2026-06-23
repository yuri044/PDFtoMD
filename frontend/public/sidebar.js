// Sidebar component — owns the editor's file-list DOM and nothing else.
// It is a "dumb" view: editor.js passes in the document data + callbacks, and
// the sidebar renders rows and reports clicks back. It holds no app state.
//
// Public API (global `Sidebar`):
//   Sidebar.init(handlers)                  — wire callbacks once at startup
//   Sidebar.render(documents, activeIndex, selected) — full repaint
//   Sidebar.setActive(activeIndex)          — move the active highlight only
//   Sidebar.markDirty(index)                — show the • dot on one row

const Sidebar = (() => {
  const listEl = document.getElementById('file-tabs');

  // Callbacks supplied by editor.js
  let onSwitch       = () => {};   // (index) → user clicked a row
  let onToggleSelect = () => {};   // (index, checked) → checkbox toggled

  function init(handlers = {}) {
    onSwitch       = handlers.onSwitch       || onSwitch;
    onToggleSelect = handlers.onToggleSelect || onToggleSelect;
  }

  function render(documents, activeIndex, selected) {
    listEl.innerHTML = '';

    documents.forEach((doc, index) => {
      const li = document.createElement('li');
      li.className = 'file-tab' + (index === activeIndex ? ' active' : '');
      li.dataset.index = index;
      li.innerHTML = `
        <input type="checkbox" class="file-check" data-index="${index}" ${selected.has(index) ? 'checked' : ''} />
        <span class="file-tab-name" title="${doc.filename}">${doc.filename}</span>
        <span class="file-tab-dot" aria-hidden="true">${doc.dirty ? '•' : ''}</span>
      `;
      listEl.appendChild(li);
    });

    listEl.querySelectorAll('.file-check').forEach(box => {
      box.addEventListener('click', (e) => {
        e.stopPropagation(); // don't trigger the row's switch handler
        onToggleSelect(Number(box.dataset.index), box.checked);
      });
    });

    listEl.querySelectorAll('.file-tab').forEach(li => {
      li.addEventListener('click', () => onSwitch(Number(li.dataset.index)));
    });
  }

  function setActive(activeIndex) {
    listEl.querySelectorAll('.file-tab').forEach(li => {
      li.classList.toggle('active', Number(li.dataset.index) === activeIndex);
    });
  }

  function markDirty(index) {
    const dot = listEl.querySelector(`.file-tab[data-index="${index}"] .file-tab-dot`);
    if (dot) dot.textContent = '•';
  }

  return { init, render, setActive, markDirty };
})();
