// Convert view — file management, drag-and-drop, and conversion.
// After a successful conversion the result is handed off to editor.js
// via openInEditor(), which handles all editor view logic.

// ─── DOM ─────────────────────────────────────────────────────────────────────
const dropZone   = document.getElementById('drop-zone');
const fileInput  = document.getElementById('file-input');
const dropLabel  = document.getElementById('drop-label');
const convertBtn = document.getElementById('convert-btn');
const statusEl   = document.getElementById('status');
const fileListEl = document.getElementById('file-list');

// ─── State ───────────────────────────────────────────────────────────────────
let selectedFiles = [];

// ─── File management ─────────────────────────────────────────────────────────

function addFiles(rawFiles) {
  const incoming = Array.from(rawFiles);
  const pdfs     = incoming.filter(f => f.type === 'application/pdf');
  const skipped  = incoming.length - pdfs.length;

  const existingNames = new Set(selectedFiles.map(f => f.name));
  const newPdfs = pdfs.filter(f => !existingNames.has(f.name));
  selectedFiles.push(...newPdfs);

  if (selectedFiles.length > 0) {
    dropLabel.textContent = `${selectedFiles.length} PDF(s) selected — drop more to add`;
    dropLabel.classList.add('has-file');
  }

  convertBtn.disabled = selectedFiles.length === 0;

  if (skipped > 0) setStatus(`${skipped} non-PDF file(s) were skipped.`, 'error');
  else setStatus('');

  renderFileList();
}

function renderFileList() {
  fileListEl.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const li = document.createElement('li');
    li.id = `file-item-${index}`;
    li.innerHTML = `
      <span class="file-name" title="${file.name}">${file.name}</span>
      <span class="file-status pending">Pending</span>
      <button class="remove-btn" aria-label="Remove ${file.name}" data-index="${index}">×</button>
    `;
    fileListEl.appendChild(li);
  });

  fileListEl.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFile(Number(btn.dataset.index)));
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);

  if (selectedFiles.length === 0) {
    dropLabel.textContent = 'Drop PDFs here, or click to browse';
    dropLabel.classList.remove('has-file');
    convertBtn.disabled = true;
    setStatus('');
  } else {
    dropLabel.textContent = `${selectedFiles.length} PDF(s) selected — drop more to add`;
  }

  renderFileList();
}

function setFileStatus(index, type, text) {
  const li = document.getElementById(`file-item-${index}`);
  if (!li) return;
  const badge = li.querySelector('.file-status');
  badge.className = `file-status ${type}`;
  badge.textContent = text;
}

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function setRemoveBtnsDisabled(disabled) {
  fileListEl.querySelectorAll('.remove-btn').forEach(btn => { btn.disabled = disabled; });
}

// ─── File input / drag-and-drop ──────────────────────────────────────────────

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) addFiles(fileInput.files);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer?.files.length > 0) addFiles(e.dataTransfer.files);
});

// ─── Conversion ──────────────────────────────────────────────────────────────

convertBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;

  convertBtn.disabled = true;
  setRemoveBtnsDisabled(true);
  setStatus('Converting…', 'loading');

  let successCount = 0;
  let errorCount   = 0;
  const results    = [];  // [{ markdown, imageMap, filename }] — one per converted file

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    setFileStatus(i, 'loading', 'Converting…');

    try {
      const form = new FormData();
      form.append('pdf', file);
      form.append('pdf_filename', file.name);

      const res = await fetch('/api/convert', { method: 'POST', body: form });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();

      // Extract ZIP in the browser so we can open the result directly in the editor
      const zip      = await JSZip.loadAsync(arrayBuffer);
      // The backend names the .md after the PDF (e.g. "document.md"), so locate
      // the markdown file by extension rather than a hardcoded name.
      const mdEntry  = Object.values(zip.files).find(f => !f.dir && f.name.endsWith('.md'));
      const markdown = mdEntry ? await mdEntry.async('text') : '';

      const imageMap = {};
      await Promise.all(
        Object.entries(zip.files)
          .filter(([path, f]) => path.startsWith('images/') && !f.dir)
          .map(async ([path, f]) => {
            const blob = await f.async('blob');
            imageMap[path.replace('images/', '')] = URL.createObjectURL(blob);
          })
      );

      // Keep every result — the editor owns these blob URLs from here on and
      // revokes them when a new conversion run replaces the collection.
      results.push({ markdown, imageMap, filename: file.name.replace(/\.pdf$/i, '.md') });

      setFileStatus(i, 'success', '✓ Done');
      successCount++;

    } catch (err) {
      setFileStatus(i, 'error', `✗ ${err.message}`);
      errorCount++;
    }
  }

  if (errorCount === 0) {
    setStatus(`All ${successCount} file(s) converted successfully.`, 'success');
  } else {
    setStatus(`${successCount} succeeded, ${errorCount} failed.`, 'error');
  }

  convertBtn.disabled = false;
  setRemoveBtnsDisabled(false);

  // Hand off to the editor — openDocuments() is defined in editor.js.
  // Wrap so a rendering error surfaces instead of silently blocking the tab switch.
  if (results.length > 0) {
    try {
      openDocuments(results);
    } catch (err) {
      setStatus(`Converted, but the editor failed to open: ${err.message}`, 'error');
    }
  }
});
