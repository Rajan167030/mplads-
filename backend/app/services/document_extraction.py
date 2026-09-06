"""Extracts plain text from an uploaded document so it can be handed to the
LLM as extra grounding context alongside retrieved project data. Supports
PDF and plain text — the two formats an analyst is actually likely to
upload (an inspection report scan turned into text, a plain notes file).
No OCR: a scanned image-only PDF will yield no extractable text, and the
caller should treat that as "no text found" rather than fail silently.
"""

import io

from pypdf import PdfReader

MAX_CHARS = 40_000  # keeps the LLM prompt bounded regardless of document size


class UnsupportedDocumentTypeError(Exception):
    pass


def extract_text(filename: str, content: bytes) -> str:
    lower = filename.lower()

    if lower.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n\n".join(pages).strip()
    elif lower.endswith(".txt") or lower.endswith(".md"):
        text = content.decode("utf-8", errors="replace").strip()
    else:
        raise UnsupportedDocumentTypeError(f"Unsupported file type: {filename!r}. Upload a .pdf, .txt, or .md file.")

    return text[:MAX_CHARS]
