import re
import statistics
import fitz  # pymupdf


BROWSER_SAFE_FORMATS = {"png", "jpeg", "jpg", "gif", "webp"}


def pdf_to_markdown(pdf_bytes: bytes) -> tuple[str, list[dict]]:
    """
    Convert PDF bytes to Markdown + extracted images.

    Returns:
        markdown  — full document as a Markdown string
        images    — list of {"filename": str, "data": bytes}
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    ##Store pages in a list so that they can be joined together later   
    pages: list[str] = []
    ##Store images in a list so that they can be joined together later
    images: list[dict] = []
    ##Xrefs tracks which images extracted so far by indexing
    seen_xrefs: set[int] = set()

    for page_num, page in enumerate(doc):
        page_md = _convert_page(page, page_num, doc, images, seen_xrefs)
        if page_md.strip():
            pages.append(page_md)

    doc.close()
    markdown = "\n\n---\n\n".join(pages)
    return markdown, images


def _convert_page(
    page: fitz.Page,
    page_num: int,
    doc: fitz.Document,
    images: list[dict],
    seen_xrefs: set[int],
) -> str:
    data = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
    blocks = data.get("blocks", [])

    # Pass 1: collect font sizes to compute the median body size
    sizes: list[float] = []
    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if span.get("text", "").strip():
                    sizes.append(span.get("size", 12.0))

    body_size = statistics.median(sizes) if sizes else 12.0

    # Pass 2: process text blocks
    parts: list[str] = []

    for block in blocks:
        if block.get("type") == 0:
            md = _convert_block(block, body_size)
            if md.strip():
                parts.append(md)

    # Pass 3: extract images via page.get_images() — more reliable than block_type==1
    # because most PDFs embed images as XObjects that don't appear as inline blocks
    for img_info in page.get_images(full=True):
        xref = img_info[0]
        if xref <= 0 or xref in seen_xrefs:
            continue
        img_counter = len(images) + 1
        filename, img_bytes = _extract_image(doc, xref, page_num, img_counter)
        if filename is None:
            continue
        seen_xrefs.add(xref)
        images.append({"filename": filename, "data": img_bytes})
        parts.append(f"![{filename}](images/{filename})")

    return "\n\n".join(parts)


def _extract_image(
    doc: fitz.Document,
    xref: int,
    page_num: int,
    img_counter: int,
) -> tuple[str | None, bytes | None]:
    """Extract one image by xref. Converts unsupported/CMYK formats to PNG."""
    try:
        base_image = doc.extract_image(xref)

        # Skip tiny decorative images (spacers, rule lines)
        if base_image["width"] < 10 or base_image["height"] < 10:
            return None, None

        ext = base_image.get("ext", "png").lower()
        img_bytes = base_image["image"]

        if ext not in BROWSER_SAFE_FORMATS:
            # jpx, jb2, ccitt, etc. — re-export as PNG via Pixmap
            pix = fitz.Pixmap(doc, xref)
            if pix.n > 4:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            img_bytes = pix.tobytes("png")
            ext = "png"

        filename = f"page{page_num + 1}_img{img_counter}.{ext}"
        return filename, img_bytes

    except Exception:
        return None, None


def _convert_block(block: dict, body_size: float) -> str:
    """Convert a single text block to one or more Markdown lines."""
    lines: list[str] = []
    for line in block.get("lines", []):
        line_text, dominant_size, is_bold = _extract_line(line, body_size)
        if not line_text:
            continue
        md_line = _classify_line(line_text, dominant_size, body_size, is_bold)
        lines.append(md_line)
    return "\n".join(lines)


def _extract_line(line: dict, body_size: float) -> tuple[str, float, bool]:
    """Merge all spans in a line into one string."""
    parts: list[str] = []
    dominant_size = body_size
    is_bold = False

    for span in line.get("spans", []):
        text = span.get("text", "")
        if not text.strip():
            continue
        parts.append(text)
        size = span.get("size", body_size)
        if size > dominant_size:
            dominant_size = size
        if span.get("flags", 0) & 16:  # bit 4 = bold
            is_bold = True

    return " ".join(parts).strip(), dominant_size, is_bold


def _classify_line(text: str, size: float, body_size: float, bold: bool) -> str:
    """Map a line to its Markdown equivalent."""
    ratio = size / body_size if body_size else 1.0

    if ratio >= 1.8 or (ratio >= 1.5 and bold):
        return f"# {text}"
    if ratio >= 1.4 or (ratio >= 1.2 and bold):
        return f"## {text}"
    if ratio >= 1.15 or (ratio >= 1.0 and bold):
        return f"### {text}"

    if text and text[0] in ("•", "–", "−", "▪", "◦", "·", "○", "●", "➢", "➤"):
        return f"- {text[1:].strip()}"

    if re.match(r"^\d+[.)]\s", text):
        return text

    return text
