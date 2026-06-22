// ─── DOM references ──────────────────────────────────────────────────────────
const dropZone   = document.getElementById('drop-zone');
const fileInput  = document.getElementById('file-input');
const dropLabel  = document.getElementById('drop-label');
const convertBtn = document.getElementById('convert-btn');
const statusEl   = document.getElementById('status');
const fileListEl = document.getElementById('file-list');

// ─── State ───────────────────────────────────────────────────────────────────
// Array of File objects the user has selected. We accumulate rather than
// replace so drag-and-drop additions append to the existing list.
let selectedFiles = [];

// ─── File management ─────────────────────────────────────────────────────────

// addFiles: called whenever the user picks or drops files.
// - Filters out anything that isn't a PDF.
// - Deduplicates by filename so dropping the same file twice is a no-op.
// - Appends valid new files to selectedFiles and re-renders the list.
function addFiles(rawFiles) {
  const incoming = Array.from(rawFiles);

  // Separate valid PDFs from anything else so we can warn about rejects.
  const pdfs    = incoming.filter(f => f.type === 'application/pdf');
  const skipped = incoming.length - pdfs.length;

  // Build a set of names already in the list to avoid duplicates.
  const existingNames = new Set(selectedFiles.map(f => f.name));
  const newPdfs = pdfs.filter(f => !existingNames.has(f.name));

  selectedFiles.push(...newPdfs);

  // Update the drop-zone label to reflect how many PDFs are queued.
  if (selectedFiles.length > 0) {
    dropLabel.textContent = `${selectedFiles.length} PDF(s) selected — drop more to add`;
    dropLabel.classList.add('has-file');
  }

  // Enable the button as soon as there is at least one file ready.
  convertBtn.disabled = selectedFiles.length === 0;

  // Warn the user if any non-PDF files were ignored.
  if (skipped > 0) {
    setStatus(`${skipped} non-PDF file(s) were skipped.`, 'error');
  } else {
    setStatus('');
  }

  renderFileList();
}

// renderFileList: rebuilds the <ul> from scratch to match selectedFiles.
// Each <li> gets a unique id ("file-item-N") so setFileStatus can target it.
// A remove button on each row lets the user dequeue a file before converting.
function renderFileList() {
  fileListEl.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const li = document.createElement('li');
    li.id = `file-item-${index}`;

    // File name on the left, status badge + remove button on the right.
    li.innerHTML = `
      <span class="file-name" title="${file.name}">${file.name}</span>
      <span class="file-status pending">Pending</span>
      <button class="remove-btn" aria-label="Remove ${file.name}" data-index="${index}">×</button>
    `;

    fileListEl.appendChild(li);
  });

  // Attach click handlers after the DOM is built.
  // Using event delegation on the list would also work, but per-button
  // listeners are simpler to read and the list is never large enough to matter.
  fileListEl.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFile(Number(btn.dataset.index)));
  });
}

// removeFile: splices one entry out of selectedFiles by its current index,
// then re-renders the list. Re-rendering also resets all indices, so the
// remaining remove buttons stay consistent with the updated array.
function removeFile(index) {
  selectedFiles.splice(index, 1);

  // Update the drop-zone label (or reset it when the list becomes empty).
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

// setFileStatus: updates the status badge for a single file row.
// `type` maps to a CSS class: 'pending' | 'loading' | 'success' | 'error'
function setFileStatus(index, type, text) {
  const li = document.getElementById(`file-item-${index}`);
  if (!li) return;

  const badge = li.querySelector('.file-status');
  badge.className = `file-status ${type}`;
  badge.textContent = text;
}

// setStatus: updates the global status line below the button.
// `type` maps to a CSS class: '' | 'loading' | 'success' | 'error'
function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

// ─── File input events ───────────────────────────────────────────────────────

// Standard file-picker: fires when the user clicks the label and selects files.
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) addFiles(fileInput.files);
});

// ─── Drag-and-drop events ────────────────────────────────────────────────────

// dragover must call preventDefault() to allow a drop event to fire.
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

// Remove the hover highlight when the drag leaves the zone.
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

// drop: extract files from the drag event and feed them through addFiles.
// Using dataTransfer.files means this works for both single and multiple drops.
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer?.files.length > 0) {
    addFiles(e.dataTransfer.files);
  }
});

// ─── Conversion ──────────────────────────────────────────────────────────────

convertBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;

  // Lock the button and all remove buttons for the entire batch so the
  // user can't mutate the array while the sequential loop is running.
  convertBtn.disabled = true;
  setRemoveBtnsDisabled(true);
  setStatus('Converting…', 'loading');

  let successCount = 0;
  let errorCount   = 0;

  // Process files one at a time (sequential).
  // This keeps backend memory flat: only one PDF is held in the Python process
  // at a time. Parallel would hold all N PDFs in memory simultaneously.
  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];

    setFileStatus(i, 'loading', 'Converting…');

    try {
      // Build a multipart form with the PDF binary and its original filename.
      // The filename is sent as a separate text field because the
      // Content-Disposition header can drop non-ASCII bytes (see server.js).
      const form = new FormData();
      form.append('pdf', file);
      form.append('pdf_filename', file.name);

      const res = await fetch('/api/convert', { method: 'POST', body: form });

      if (!res.ok) {
        // The server returns JSON error objects; fall back to a generic message.
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      // Response is a binary ZIP — read it as an ArrayBuffer, not text/json.
      const arrayBuffer = await res.arrayBuffer();

      // Name the download after the source PDF (e.g. "report.pdf" → "report.zip").
      const zipName = file.name.replace(/\.pdf$/i, '.zip');
      triggerDownload(arrayBuffer, zipName, 'application/zip');

      setFileStatus(i, 'success', '✓ Downloaded');
      successCount++;

    } catch (err) {
      // Show the error message directly in the file row, not just the status bar.
      setFileStatus(i, 'error', `✗ ${err.message}`);
      errorCount++;
    }
  }

  // Summary line once the whole batch is done.
  if (errorCount === 0) {
    setStatus(`All ${successCount} file(s) converted successfully.`, 'success');
  } else {
    setStatus(`${successCount} succeeded, ${errorCount} failed.`, 'error');
  }

  // Re-enable everything so the user can add/remove files or run again.
  convertBtn.disabled = false;
  setRemoveBtnsDisabled(false);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

// setRemoveBtnsDisabled: enables or disables every remove button in the list.
// Called at the start and end of a conversion batch to prevent the user from
// mutating selectedFiles while the sequential loop is running.
function setRemoveBtnsDisabled(disabled) {
  fileListEl.querySelectorAll('.remove-btn').forEach(btn => {
    btn.disabled = disabled;
  });
}

// triggerDownload: programmatically fires a file download in the browser.
// Creates a temporary object URL, clicks a hidden <a>, then revokes the URL
// to free memory. Works for any binary content passed as an ArrayBuffer.
function triggerDownload(content, filename, mimeType = 'application/octet-stream') {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
