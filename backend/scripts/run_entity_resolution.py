"""Runs multilingual entity resolution over all projects currently in the
database: computes missing embeddings, retrieves same-type candidates by
embedding similarity, scores each candidate pair on six independent features,
and persists MATCH/POSSIBLE_MATCH verdicts to entity_matches."""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.nlp.entity_resolution import run_entity_resolution  # noqa: E402


def main() -> None:
    db = SessionLocal()
    started = time.time()
    try:
        report = run_entity_resolution(db)
    finally:
        db.close()
    elapsed = time.time() - started

    print("Entity resolution report")
    print("-------------------------")
    print(f"Embeddings computed:  {report.embeddings_computed}")
    print(f"Projects considered:  {report.projects_considered}")
    print(f"Pairs evaluated:      {report.pairs_evaluated}")
    print(f"Matches:              {report.matches}")
    print(f"Possible matches:     {report.possible_matches}")
    print(f"Elapsed:              {elapsed:.1f}s")


if __name__ == "__main__":
    main()
