from typing import Literal

from pydantic import BaseModel


class GeoJSONPointGeometry(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: tuple[float, float]  # [longitude, latitude], per GeoJSON spec


class ProjectFeatureProperties(BaseModel):
    id: str
    external_project_id: str
    project_name: str
    project_type: str
    state: str
    district: str
    status: str
    risk_score: float | None
    risk_band: str | None


class ProjectFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: GeoJSONPointGeometry
    properties: ProjectFeatureProperties


class ProjectFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[ProjectFeature]
