# PDF to Markdown Converter

Two-process web app: PDF → Markdown + images bundled as a ZIP.
Full architecture and design decisions: [`.claude/plan/pdf-to-md.md`](.claude/plan/pdf-to-md.md)

---

## Start Commands

```powershell
# Backend (run first) — must use the venv Python to avoid system-level permission errors
cd backend
..\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend && npm start          # port 5556
# or: npm run dev                 # nodemon watch mode
```

Health check: `curl http://localhost:8000/health` → `{"status":"ok"}`

---

## Verify After Every Change

Run these before reporting a task complete:

1. **Backend starts cleanly** — no import errors, `/health` returns `{"status":"ok"}`
2. **Frontend starts cleanly** — no missing module errors
3. **End-to-end test** — upload a PDF at `http://localhost:5556`, confirm ZIP downloads with `output.md` and an `images/` folder
4. **Python type hints stay valid** — `python -m py_compile backend/converter.py backend/main.py`

---

## Code Conventions

### Python (`backend/`)

- All PDF parsing logic lives in `converter.py`. Prefer adding functions there over touching `main.py`.
- Prefer `tuple[str | None, bytes | None]` return types for extraction helpers — callers check for `None` before use.
- Prefer explicit `try/except Exception` with `return None, None` in extraction paths rather than letting exceptions propagate.
- `fitz` is the PyMuPDF import alias — use `fitz`, never `pymupdf` directly.

### JavaScript (`frontend/`)

- `server.js` is the only server file. Prefer adding routes there rather than splitting into a router module.
- `responseType: 'arraybuffer'` on the axios call is load-bearing — the response is a binary ZIP. Never change it to `'json'` or `'text'`.
- Prefer `Buffer.from(response.data)` when sending the ZIP response — not `.toString()` or similar.

### General

- Prefer positive patterns over negative rules in code comments.
- Prefer in-memory processing (`BytesIO`, `multer.memoryStorage()`) over writing temp files to disk.
- File size limit is 20 MB on both layers — keep them in sync if changed.

---

## Key Invariants

| Invariant                        | Where enforced                                     |
| -------------------------------- | -------------------------------------------------- |
| ZIP response is binary, not text | `axios responseType: 'arraybuffer'` in `server.js` |
| Images deduplicated by xref      | `seen_xrefs` set in `converter.py:pdf_to_markdown` |
| Tiny images (< 10×10 px) skipped | `_extract_image` in `converter.py`                 |
| Unsupported image formats → PNG  | `_extract_image` Pixmap fallback                   |
| CMYK → sRGB before PNG export    | `pix.n > 4` check in `_extract_image`              |

---

## Where to Make Changes

| Goal                                | File                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| Change heading detection thresholds | `backend/converter.py` → `_classify_line`                             |
| Add new image format support        | `backend/converter.py` → `BROWSER_SAFE_FORMATS`                       |
| Add table detection                 | `backend/converter.py` → `_convert_page` (use `page.find_tables()`)   |
| Add OCR for scanned PDFs            | `backend/converter.py` → before `fitz.open()` call                    |
| Change file size limit              | `frontend/server.js` multer limits + `backend/main.py` `MAX_PDF_SIZE` |
| Modify ZIP structure                | `backend/main.py` → `_build_zip`                                      |
| Change UI                           | `frontend/public/`                                                    |

---

## Environment Variables

| Variable         | Default                 | Purpose             |
| ---------------- | ----------------------- | ------------------- |
| `PORT`           | `5556`                  | Express listen port |
| `PYTHON_API_URL` | `http://localhost:8000` | FastAPI base URL    |

## Things you should be careful

Make sure you follow software development life cycle as principle
