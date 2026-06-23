// Editor view — tab switching, multi-document state, live Markdown preview,
// file/folder loading, and ZIP assembly. openDocuments() is the public entry
// point called by app.js after conversion.

// ─── DOM: tabs ───────────────────────────────────────────────────────────────
const tabButtons  = document.querySelectorAll('.tab');
const viewConvert = document.getElementById('view-convert');
const viewEditor  = document.getElementById('view-editor');

// ─── DOM: editor toolbar ─────────────────────────────────────────────────────
const editorFilenameEl   = document.getElementById('editor-filename');
const editorStatusEl     = document.getElementById('editor-status');
const downloadSelectedBtn = document.getElementById('download-selected-btn');
const downloadAllBtn     = document.getElementById('download-all-btn');
const openFileBtn        = document.getElementById('open-file-btn');
const openFolderBtn      = document.getElementById('open-folder-btn');
const mdFileInput        = document.getElementById('md-file-input');
const folderInput        = document.getElementById('folder-input');

// ─── DOM: split pane (the file list is owned by the Sidebar component) ─────────
const mdEditorEl  = document.getElementById('md-editor');
const mdPreviewEl = document.getElementById('md-preview');

// ─── State ───────────────────────────────────────────────────────────────────
let documents   = [];       // [{ filename, markdown, imageMap, dirty }]
let activeIndex = -1;       // which document is loaded in the editor pane
const selected  = new Set(); // indices checked for "Download Selected"

// Wire the sidebar's row/checkbox events back to editor logic.
Sidebar.init({
  onSwitch: (index) => switchTo(index),
  onToggleSelect: (index, checked) => {
    if (checked) selected.add(index); else selected.delete(index);
    updateDownloadButtons();
  },
});

// ─── Tab switching (Convert / Editor) ─────────────────────────────────────────

function switchTab(name) {
  tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
  viewConvert.classList.toggle('active', name === 'convert');
  viewEditor.classList.toggle('active', name === 'editor');
}

tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// ─── Public entry point (called from app.js after conversion) ─────────────────

// Replaces the whole collection with a fresh conversion run, then opens the editor.
function openDocuments(docs) {
  revokeAllImages();
  documents = [];
  selected.clear();
  activeIndex = -1;

  docs.forEach(d => documents.push({
    filename: uniqueName(d.filename),
    markdown: d.markdown,
    imageMap: d.imageMap || {},
    dirty: false,
  }));

  Sidebar.render(documents, activeIndex, selected);
  if (documents.length > 0) switchTo(0);
  updateDownloadButtons();
  switchTab('editor');
}

// ─── Document collection helpers ──────────────────────────────────────────────

function revokeAllImages() {
  documents.forEach(doc => {
    Object.values(doc.imageMap).forEach(url => URL.revokeObjectURL(url));
  });
}

// Disambiguate a filename that already exists in the collection: "report (2).md".
function uniqueName(name) {
  const taken = new Set(documents.map(d => d.filename));
  if (!taken.has(name)) return name;

  const dot  = name.lastIndexOf('.');
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext  = dot === -1 ? ''   : name.slice(dot);

  let n = 2;
  while (taken.has(`${base} (${n})${ext}`)) n++;
  return `${base} (${n})${ext}`;
}

// Add a single document to the collection and switch to it (used by Open .md / Folder).
function addDocument(filename, markdown, imageMap = {}) {
  documents.push({ filename: uniqueName(filename), markdown, imageMap, dirty: false });
  Sidebar.render(documents, activeIndex, selected);
  switchTo(documents.length - 1);
  updateDownloadButtons();
}

// ─── Active document load / save ──────────────────────────────────────────────

// Persist the current textarea content back into the active document. MUST run
// before switching files so in-progress edits are not lost.
function saveActiveDoc() {
  if (activeIndex < 0) return;
  documents[activeIndex].markdown = mdEditorEl.value;
}

function switchTo(index) {
  if (index < 0 || index >= documents.length) return;
  saveActiveDoc();
  activeIndex = index;

  const doc = documents[index];
  mdEditorEl.value = doc.markdown;
  editorFilenameEl.textContent = doc.filename;
  renderPreview();
  Sidebar.setActive(activeIndex);
}

// ─── Dirty tracking ────────────────────────────────────────────────────────────

function markActiveDirty() {
  if (activeIndex < 0) return;
  const doc = documents[activeIndex];
  if (doc.dirty) return;            // already flagged — avoid redundant DOM work
  doc.dirty = true;
  Sidebar.markDirty(activeIndex);
}

// ─── Live preview ─────────────────────────────────────────────────────────────

function renderPreview() {
  const imageMap = activeIndex >= 0 ? documents[activeIndex].imageMap : {};
  let md = mdEditorEl.value;
  // Swap relative image paths for blob URLs so the preview can render them
  md = md.replace(/!\[([^\]]*)\]\(images\/([^)\s]+)\)/g, (match, alt, fname) => {
    const url = imageMap[fname];
    return url ? `![${alt}](${url})` : match;
  });
  mdPreviewEl.innerHTML = marked.parse(md);
}

mdEditorEl.addEventListener('input', () => {
  markActiveDirty();
  renderPreview();
});

// ─── Synced scroll ───────────────────────────────────────────────────────────

let syncingScroll = false;

mdEditorEl.addEventListener('scroll', () => {
  if (syncingScroll) return;
  syncingScroll = true;
  const ratio = mdEditorEl.scrollTop / Math.max(1, mdEditorEl.scrollHeight - mdEditorEl.clientHeight);
  mdPreviewEl.scrollTop = ratio * (mdPreviewEl.scrollHeight - mdPreviewEl.clientHeight);
  requestAnimationFrame(() => { syncingScroll = false; });
});

mdPreviewEl.addEventListener('scroll', () => {
  if (syncingScroll) return;
  syncingScroll = true;
  const ratio = mdPreviewEl.scrollTop / Math.max(1, mdPreviewEl.scrollHeight - mdPreviewEl.clientHeight);
  mdEditorEl.scrollTop = ratio * (mdEditorEl.scrollHeight - mdEditorEl.clientHeight);
  requestAnimationFrame(() => { syncingScroll = false; });
});

// ─── Status messages ─────────────────────────────────────────────────────────

let statusTimer = null;

function setEditorStatus(msg, type = '') {
  clearTimeout(statusTimer);
  editorStatusEl.textContent = msg;
  editorStatusEl.className = 'editor-status' + (type ? ` ${type}` : '');
  if (msg) {
    statusTimer = setTimeout(() => {
      editorStatusEl.textContent = '';
      editorStatusEl.className = 'editor-status';
    }, 3000);
  }
}

function updateDownloadButtons() {
  downloadAllBtn.disabled      = documents.length === 0;
  downloadSelectedBtn.disabled = selected.size === 0;
}

// ─── Open .md file (adds to the collection) ───────────────────────────────────

openFileBtn.addEventListener('click', () => mdFileInput.click());

mdFileInput.addEventListener('change', async () => {
  const file = mdFileInput.files[0];
  mdFileInput.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    addDocument(file.name, text, {});
    switchTab('editor');
    setEditorStatus('Loaded', 'success');
  } catch {
    setEditorStatus('Failed to read file', 'error');
  }
});

// ─── Open folder (expects <folder>/output.md + <folder>/images/) ──────────────

openFolderBtn.addEventListener('click', () => folderInput.click());

folderInput.addEventListener('change', async () => {
  const files = Array.from(folderInput.files);
  folderInput.value = '';
  if (files.length === 0) return;

  // Find a .md file at the root of the selected folder (depth 2: folder/file.md)
  const mdFile = files.find(f => {
    const parts = f.webkitRelativePath.split('/');
    return parts.length === 2 && f.name.endsWith('.md');
  });

  if (!mdFile) {
    setEditorStatus('No .md file found in folder root', 'error');
    return;
  }

  try {
    const text = await mdFile.text();
    const imageMap = {};

    for (const file of files) {
      const parts = file.webkitRelativePath.split('/');
      // Match <folder>/images/<filename>
      if (parts.length === 3 && parts[1] === 'images') {
        imageMap[file.name] = URL.createObjectURL(file);
      }
    }

    addDocument(mdFile.name, text, imageMap);
    switchTab('editor');
    const count = Object.keys(imageMap).length;
    setEditorStatus(`Loaded with ${count} image(s)`, 'success');
  } catch {
    setEditorStatus('Failed to read folder', 'error');
  }
});

// ─── Download ────────────────────────────────────────────────────────────────

// Add one document's .md + images/ into a JSZip target, optionally under a prefix.
async function addDocToZip(zip, doc, prefix = '') {
  zip.file(`${prefix}${doc.filename}`, doc.markdown);
  await Promise.all(
    Object.entries(doc.imageMap).map(async ([filename, blobUrl]) => {
      const blob = await (await fetch(blobUrl)).blob();
      zip.file(`${prefix}images/${filename}`, blob);
    })
  );
}

// Bundle the given documents: a single .zip for one doc, or one archive with a
// per-document subfolder for many (subfolders avoid image filename collisions).
async function downloadDocs(docs, label) {
  if (docs.length === 0) return;
  saveActiveDoc(); // make sure the active file's latest edits are included

  setEditorStatus('Preparing ZIP…');
  downloadSelectedBtn.disabled = true;
  downloadAllBtn.disabled      = true;

  try {
    const zip = new JSZip();

    if (docs.length === 1) {
      await addDocToZip(zip, docs[0]);
    } else {
      for (const doc of docs) {
        const folder = doc.filename.replace(/\.md$/i, '');
        await addDocToZip(zip, doc, `${folder}/`);
      }
    }

    const zipBlob  = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const zipName  = docs.length === 1
      ? `${docs[0].filename.replace(/\.md$/i, '')}.zip`
      : 'archive.zip';
    triggerEditorDownload(URL.createObjectURL(zipBlob), zipName);
    setEditorStatus(`Downloaded ${label}`, 'success');
  } catch {
    setEditorStatus('Download failed', 'error');
  } finally {
    updateDownloadButtons();
  }
}

downloadSelectedBtn.addEventListener('click', () => {
  const docs = [...selected].sort((a, b) => a - b).map(i => documents[i]);
  downloadDocs(docs, `${docs.length} selected`);
});

downloadAllBtn.addEventListener('click', () => {
  downloadDocs(documents, `all ${documents.length}`);
});

function triggerEditorDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
