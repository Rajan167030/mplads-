"""Text normalization pipeline for entity resolution (spec §7):
Unicode normalization -> whitespace/punctuation cleanup -> abbreviation
expansion -> a romanized phonetic key for cross-spelling comparison.

This does the cheap, rule-based cleanup before the multilingual embedding
model (app.nlp.embeddings) does the actual semantic heavy lifting — it is not
a substitute for the embedding step, just a way to strip noise that would
otherwise dilute it (and to give the phonetic-key feature something to work
with for same-script spelling variants like "Bhawan" vs "Bhavan").
"""

import re
import unicodedata

# Common abbreviations seen in government works-list descriptions.
ABBREVIATIONS = {
    r"\brd\b": "road",
    r"\bconstn\b": "construction",
    r"\bconst\b": "construction",
    r"\bsch\b": "school",
    r"\bbldg\b": "building",
    r"\bdept\b": "department",
    r"\bdistt\b": "district",
    r"\bvill\b": "village",
    r"\bgovt\b": "government",
    r"\bphc\b": "primary health centre",
    r"\bchc\b": "community health centre",
    r"\bwss\b": "water supply scheme",
    r"\bcc road\b": "cement concrete road",
    r"\bhosp\b": "hospital",
    r"\bpvt\b": "private",
    r"\bltd\b": "limited",
}

_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_WHITESPACE_RE = re.compile(r"\s+")

# Applied in order, on an already-lowercased string, to fold common romanized
# Indic-language spelling variants onto a shared key (not a real phonetic
# algorithm — a handful of high-value substitutions for the variants actually
# seen in MPLADS-style data: w/v, ee/i, oo/u, double consonants).
_PHONETIC_SUBSTITUTIONS = [
    (r"w", "v"),
    (r"ee", "i"),
    (r"oo", "u"),
    (r"ph", "f"),
    (r"(.)\1+", r"\1"),  # collapse doubled letters
]


def normalize_unicode(text: str) -> str:
    return unicodedata.normalize("NFKC", text)


def normalize_whitespace_punctuation(text: str, keep_punct: bool = False) -> str:
    text = text if keep_punct else _PUNCT_RE.sub(" ", text)
    return _WHITESPACE_RE.sub(" ", text).strip()


def expand_abbreviations(text: str) -> str:
    lowered = text.lower()
    for pattern, expansion in ABBREVIATIONS.items():
        lowered = re.sub(pattern, expansion, lowered)
    return lowered


def full_normalize(text: str) -> str:
    """The text fed to the embedding model: unicode-normalized, abbreviation-
    expanded, whitespace/punctuation-clean. Case is preserved where possible
    since the multilingual model is case-aware; abbreviation expansion already
    lowercases internally so the output is lowercase overall."""
    text = normalize_unicode(text)
    text = expand_abbreviations(text)
    return normalize_whitespace_punctuation(text)


def romanized_phonetic_key(text: str) -> str:
    """A coarse fold for comparing same-script spelling variants (e.g.
    "Samudayik Bhawan" vs "Samudayik Bhavan"). Only meaningful for Latin-script
    text — callers should skip it for native-script strings."""
    key = normalize_whitespace_punctuation(normalize_unicode(text).lower())
    for pattern, replacement in _PHONETIC_SUBSTITUTIONS:
        key = re.sub(pattern, replacement, key)
    return key
