"""Thin re-export: language detection already runs during ingestion
(app.ingestion.normalizers.detect_language) so entity resolution reuses the
exact same function rather than a second implementation that could drift."""

from app.ingestion.normalizers import detect_language

__all__ = ["detect_language"]
