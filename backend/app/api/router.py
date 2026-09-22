from fastapi import APIRouter

from app.api import (
    assistant,
    auth,
    complaints,
    contractors,
    data_quality,
    entity_resolution,
    financials,
    graph,
    health,
    ingestion,
    investigations,
    map as map_api,
    ml,
    patterns,
    pre_sanction,
    projects,
    reports,
    risk_scores,
    risk_signals,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(ingestion.router)
api_router.include_router(complaints.router)
api_router.include_router(data_quality.router)
api_router.include_router(entity_resolution.router)
api_router.include_router(risk_signals.router)
api_router.include_router(ml.router)
api_router.include_router(risk_scores.router)
api_router.include_router(graph.router)
api_router.include_router(pre_sanction.router)
api_router.include_router(projects.router)
api_router.include_router(contractors.router)
api_router.include_router(patterns.router)
api_router.include_router(map_api.router)
api_router.include_router(financials.router)
api_router.include_router(assistant.router)
api_router.include_router(investigations.router)
api_router.include_router(reports.router)
api_router.include_router(users.router)
