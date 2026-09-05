from pydantic import BaseModel


class PatternSummary(BaseModel):
    signal_type: str
    source: str
    count: int
    average_score: float
    top_states: list[str]


class PatternSummaryOut(BaseModel):
    total_signals: int
    patterns: list[PatternSummary]
