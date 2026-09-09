"""Multilingual sentence embedding wrapper. One shared model instance per
process — SentenceTransformer load is expensive (~470MB, seconds to load),
never per-request.

Model: paraphrase-multilingual-MiniLM-L12-v2, 384-dim — chosen because its
output dimension matches Project.name_embedding / EMBEDDING_DIM without a
migration, and because it's specifically trained for cross-lingual paraphrase
similarity (English vs Hindi vs Tamil describing the same facility should sit
close together), which is exactly what P04/entity resolution needs.
"""

from functools import lru_cache

import numpy as np

from app.models.project import EMBEDDING_DIM

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"


@lru_cache(maxsize=1)
def get_model():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as e:
        raise RuntimeError(
            "Entity resolution is unavailable on this deployment "
            "(sentence-transformers/torch excluded to fit the host's size limit)."
        ) from e

    model = SentenceTransformer(MODEL_NAME)
    assert model.get_sentence_embedding_dimension() == EMBEDDING_DIM, (
        f"{MODEL_NAME} outputs {model.get_sentence_embedding_dimension()}-dim vectors, "
        f"expected {EMBEDDING_DIM} to match the projects.name_embedding column."
    )
    return model


def embed_texts(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.empty((0, EMBEDDING_DIM))
    return get_model().encode(texts, show_progress_bar=False, convert_to_numpy=True)


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0].tolist()
