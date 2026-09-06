import enum


class ProjectType(str, enum.Enum):
    ROAD = "ROAD"
    SCHOOL = "SCHOOL"
    COMMUNITY_HALL = "COMMUNITY_HALL"
    WATER_INFRASTRUCTURE = "WATER_INFRASTRUCTURE"
    HEALTH_CENTRE = "HEALTH_CENTRE"
    SANITATION = "SANITATION"
    PUBLIC_FACILITY = "PUBLIC_FACILITY"
    # Added when real MPLADS eSAKSHI export data was mixed in — these two
    # categories alone accounted for ~3,500 of ~9,964 real completed works
    # ("Lighting of public spaces"/"Street lights" and gym/park/playground/
    # stadium works), too large and cost-heterogeneous a slice to fold into
    # PUBLIC_FACILITY without distorting that peer group's statistics.
    LIGHTING = "LIGHTING"
    SPORTS_RECREATION = "SPORTS_RECREATION"


class ProjectStatus(str, enum.Enum):
    SANCTIONED = "SANCTIONED"
    ONGOING = "ONGOING"
    DELAYED = "DELAYED"
    COMPLETED = "COMPLETED"


class PaymentType(str, enum.Enum):
    ADVANCE = "ADVANCE"
    MILESTONE = "MILESTONE"
    FINAL = "FINAL"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CLEARED = "CLEARED"
    FAILED = "FAILED"


class MilestoneStatus(str, enum.Enum):
    PENDING = "PENDING"
    ON_TRACK = "ON_TRACK"
    DELAYED = "DELAYED"
    COMPLETED = "COMPLETED"


class EvidenceType(str, enum.Enum):
    PHOTO = "PHOTO"
    DOCUMENT = "DOCUMENT"
    INSPECTION_REPORT = "INSPECTION_REPORT"
    INVOICE = "INVOICE"


class SignalType(str, enum.Enum):
    PAYMENT_PROGRESS_MISMATCH = "PAYMENT_PROGRESS_MISMATCH"
    COST_ANOMALY = "COST_ANOMALY"
    DELAY_ANOMALY = "DELAY_ANOMALY"
    POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE"
    CONTRACTOR_RISK_PATTERN = "CONTRACTOR_RISK_PATTERN"
    GEOGRAPHIC_CONCENTRATION = "GEOGRAPHIC_CONCENTRATION"
    PAYMENT_ACCELERATION = "PAYMENT_ACCELERATION"
    PROGRESS_INCONSISTENCY = "PROGRESS_INCONSISTENCY"
    EVIDENCE_ANOMALY = "EVIDENCE_ANOMALY"
    OVERPAYMENT = "OVERPAYMENT"
    ML_STATISTICAL_ANOMALY = "ML_STATISTICAL_ANOMALY"
    ML_AUTOENCODER_ANOMALY = "ML_AUTOENCODER_ANOMALY"
    ML_CLUSTER_OUTLIER = "ML_CLUSTER_OUTLIER"
    MULTI_SIGNAL_CORRELATION = "MULTI_SIGNAL_CORRELATION"
    ML_ENSEMBLE_CONSENSUS = "ML_ENSEMBLE_CONSENSUS"


class SignalSource(str, enum.Enum):
    RULE = "RULE"
    ML = "ML"
    CORRELATED = "CORRELATED"


class Severity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class InvestigationStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class InvestigationResolution(str, enum.Enum):
    LEGITIMATE = "LEGITIMATE"
    NEEDS_FURTHER_INVESTIGATION = "NEEDS_FURTHER_INVESTIGATION"
    ISSUE_CONFIRMED = "ISSUE_CONFIRMED"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    OFFICER = "OFFICER"
    ANALYST = "ANALYST"
    VIEWER = "VIEWER"


class MatchVerdict(str, enum.Enum):
    MATCH = "MATCH"
    POSSIBLE_MATCH = "POSSIBLE_MATCH"
    DIFFERENT = "DIFFERENT"


class MessageRole(str, enum.Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"
