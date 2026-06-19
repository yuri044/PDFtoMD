

const dropZone   = document.getElementById('drop-zone');
const fileInput  = document.getElementById('file-input');
const dropLabel  = document.getElementById('drop-label');
const convertBtn = document.getElementById('convert-btn');
const statusEl   = document.getElementById('status');

let selectedFile = null;

function setFile(file) {
  if (!file || file.type !== 'application/pdf') {
    setStatus('Please select a valid PDF file.', 'error');
    return;
  }
  selectedFile = file;
  dropLabel.textContent = file.name;
  dropLabel.classList.add('has-file');
  convertBtn.disabled = false; //Initial status of button should be not clicked, therefore = false
  setStatus('');
}

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
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
  const file = e.dataTransfer?.files[0];
  if (file) setFile(file);
});

convertBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  convertBtn.disabled = true;
  setStatus('Converting…', 'loading');

  try {
    const form = new FormData();
    form.append('pdf', selectedFile);
    // send filename as a plain text field — busboy decodes text fields as UTF-8,
    // unlike the Content-Disposition filename header which drops 0x80-0x9F bytes
    form.append('pdf_filename', selectedFile.name);

    const res = await fetch('/api/convert', { method: 'POST', body: form });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(body.error || `Server error ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const filename = selectedFile.name.replace(/\.pdf$/i, '.zip');
    triggerDownload(arrayBuffer, filename, 'application/zip');
    setStatus(`Done — ${filename} downloaded.`, 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    convertBtn.disabled = false;
  }
});

function triggerDownload(content, filename, mimeType = 'application/octet-stream') {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
