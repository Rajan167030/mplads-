import re
from datetime import date, datetime

from langdetect import DetectorFactory, LangDetectException, detect

DetectorFactory.seed = 0  # deterministic langdetect output

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_text(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "n/a", "na"}:
        return None
    return _WHITESPACE_RE.sub(" ", text)


def normalize_name_key(value: str) -> str:
    """Canonical key for exact-ish contractor/agency matching before Phase 3's
    fuzzy/semantic resolution takes over."""
    text = normalize_text(value) or ""
    text = re.sub(r"[^\w\s]", "", text.lower())
    return _WHITESPACE_RE.sub(" ", text).strip()


def parse_date(value) -> date | None:
    text = normalize_text(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d-%b-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_float(value) -> float | None:
    text = normalize_text(value)
    if not text:
        return None
    try:
        return float(str(text).replace(",", ""))
    except ValueError:
        return None


def detect_language(text: str | None) -> str | None:
    if not text:
        return None
    try:
        return detect(text)
    except LangDetectException:
        return None
