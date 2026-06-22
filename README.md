# PDF to Markdown Converter

A two-process web application that converts PDF files into clean Markdown text and extracted images, bundled together as a downloadable ZIP archive.

---

## Overview

Upload a PDF through the browser UI and receive a ZIP file containing:

- **`output.md`** — the PDF content converted to Markdown, with headings, paragraphs, and image references
- **`images/`** — all embedded images extracted from the PDF in browser-safe formats (JPEG, PNG, etc.)

### Architecture

```
Browser (HTML/CSS/JS)
      │  upload PDF (multipart)
      ▼
Frontend  ── Express / Node.js ── port 3000
      │  forward PDF (multipart)
      ▼
Backend   ── FastAPI / Python ── port 8000
      │  parse with PyMuPDF, build ZIP in memory
      ▼
      ZIP  ←─ streamed back through Frontend to Browser
```

---

## Prerequisites

| Layer    | Runtime        | Version (recommended) |
|----------|----------------|-----------------------|
| Backend  | Python         | 3.10+                 |
| Frontend | Node.js / npm  | 18+                   |

---

## Installation

### 1 — Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2 — Frontend

```bash
cd frontend
npm install
```

---

## Running the App

Start the **backend first**, then the frontend in a separate terminal.

```bash
# Terminal 1 — Backend (FastAPI)
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (Express)
cd frontend
npm start          # standard mode  (port 3000)
# or
npm run dev        # watch mode with nodemon
```

Open **http://localhost:3000** in your browser.

### Health Check

```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

---

## Project Structure

```
PDFToMD/
├── backend/
│   ├── main.py          # FastAPI app — /convert endpoint & ZIP builder
│   ├── converter.py     # PDF parsing logic (PyMuPDF / fitz)
│   └── requirements.txt
├── frontend/
│   ├── server.js        # Express gateway — proxies upload to backend
│   ├── package.json
│   └── public/
│       ├── index.html   # Upload UI
│       ├── app.js       # Client-side JS (fetch, download trigger)
│       └── style.css
├── CLAUDE.md            # Developer reference & conventions
└── README.md
```

---

## Configuration

Both layers expose environment variables for easy deployment customisation:

| Variable         | Default                   | Description                        |
|------------------|---------------------------|------------------------------------|
| `PORT`           | `3000`                    | Express server listen port         |
| `PYTHON_API_URL` | `http://localhost:8000`   | FastAPI base URL (used by Express) |

---

## Key Behaviours & Limits

| Feature                         | Detail                                                  |
|---------------------------------|---------------------------------------------------------|
| Max file size                   | **20 MB** (enforced on both frontend and backend)       |
| Image deduplication             | Images are deduplicated by internal PDF cross-reference |
| Tiny image filtering            | Images smaller than **10 × 10 px** are skipped         |
| Unsupported image formats       | Automatically converted to **PNG**                      |
| CMYK colour space               | Converted to **sRGB** before PNG export                 |
| Processing strategy             | Fully in-memory — no temporary files written to disk    |

---

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Backend  | Python · FastAPI · Uvicorn · PyMuPDF (`fitz`)   |
| Frontend | Node.js · Express · Multer · Axios              |
| UI       | Vanilla HTML / CSS / JavaScript                 |

---

## License

This project is unlicensed — see repository owner for usage rights.
