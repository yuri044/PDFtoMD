import io
import zipfile
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from converter import pdf_to_markdown

app = FastAPI(title="PDF→Markdown API", version="1.1.0")

MAX_PDF_SIZE = 20 * 1024 * 1024  # 20 MB


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert")
async def convert(file: UploadFile = File(...), filename: str | None = None):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")

    if len(content) > MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit.")

    try:
        # `filename` query param is URL-decoded UTF-8 — safe for Japanese/CJK.
        # Fall back to file.filename only when the param is absent.
        raw_name = filename or file.filename or "output"
        md_filename = Path(raw_name).stem + ".md"
        markdown, images = pdf_to_markdown(content)
        zip_bytes = _build_zip(markdown, images, md_filename)
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="output.zip"'},
    )


def _build_zip(markdown: str, images: list[dict], md_filename: str) -> bytes:
    """Bundle the named .md file and all extracted images into an in-memory ZIP."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(md_filename, markdown.encode("utf-8"))
        for img in images:
            zf.writestr(f"images/{img['filename']}", img["data"])
    buf.seek(0)
    return buf.read()
