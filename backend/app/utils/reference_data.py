"""Shared reference data: states/districts, per-project-type peer cost/duration
profiles, and a small multilingual facility-name lexicon.

Used by both the synthetic data generator (backend/scripts) and, from Phase 4
onward, the contextual anomaly detector's peer-group logic — so the two stay
consistent with each other rather than drifting apart.
"""

from app.models.enums import ProjectType

# state -> (districts, (lat_center, lon_center), approx spread in degrees)
STATES: dict[str, dict] = {
    "Assam": {
        "districts": ["Kamrup", "Dibrugarh", "Jorhat", "Nagaon", "Sivasagar", "Tinsukia", "Barpeta"],
        "center": (26.2, 92.9),
        "spread": 1.3,
    },
    "Bihar": {
        "districts": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia", "Nalanda"],
        "center": (25.6, 85.5),
        "spread": 1.6,
    },
    "Nagaland": {
        "districts": ["Kohima", "Dimapur", "Mokokchung", "Wokha", "Zunheboto", "Tuensang", "Phek"],
        "center": (26.1, 94.5),
        "spread": 0.7,
    },
    "Uttar Pradesh": {
        "districts": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Meerut", "Prayagraj", "Gorakhpur", "Bareilly"],
        "center": (27.0, 80.9),
        "spread": 2.5,
    },
    "Odisha": {
        "districts": ["Cuttack", "Puri", "Khordha", "Ganjam", "Sambalpur", "Balasore", "Mayurbhanj"],
        "center": (20.5, 84.8),
        "spread": 1.8,
    },
    "Kerala": {
        "districts": ["Ernakulam", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam", "Kannur", "Palakkad"],
        "center": (10.3, 76.3),
        "spread": 1.2,
    },
    "Maharashtra": {
        "districts": ["Pune", "Nagpur", "Nashik", "Aurangabad", "Kolhapur", "Solapur", "Thane", "Amravati"],
        "center": (19.5, 76.0),
        "spread": 2.6,
    },
    "Tamil Nadu": {
        "districts": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode"],
        "center": (11.1, 78.6),
        "spread": 1.9,
    },
    "West Bengal": {
        "districts": ["Kolkata", "Howrah", "Darjeeling", "Murshidabad", "Nadia", "Bardhaman", "Malda"],
        "center": (23.5, 87.5),
        "spread": 1.7,
    },
    "Rajasthan": {
        "districts": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Alwar"],
        "center": (26.9, 73.8),
        "spread": 2.8,
    },
    "Punjab": {
        "districts": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Hoshiarpur"],
        "center": (30.9, 75.5),
        "spread": 1.1,
    },
    "Gujarat": {
        "districts": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh"],
        "center": (22.5, 71.5),
        "spread": 2.2,
    },
    "Karnataka": {
        "districts": ["Bengaluru Urban", "Mysuru", "Belagavi", "Mangaluru", "Hubballi", "Kalaburagi", "Tumakuru"],
        "center": (14.5, 75.7),
        "spread": 2.4,
    },
    "Madhya Pradesh": {
        "districts": ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain", "Sagar", "Rewa"],
        "center": (23.5, 78.5),
        "spread": 2.6,
    },
    "Telangana": {
        "districts": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Nalgonda"],
        "center": (17.9, 79.2),
        "spread": 1.6,
    },
    "Delhi": {
        "districts": ["New Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi", "Central Delhi", "North East Delhi"],
        "center": (28.6139, 77.2090),
        "spread": 0.15,  # NCT of Delhi is geographically compact vs. the states above
    },
}

STATE_CODES = {
    "Assam": "ASM", "Bihar": "BHR", "Nagaland": "NAG", "Uttar Pradesh": "UP", "Odisha": "ODI",
    "Kerala": "KER", "Maharashtra": "MH", "Tamil Nadu": "TN", "West Bengal": "WB", "Rajasthan": "RAJ",
    "Punjab": "PUN", "Gujarat": "GUJ", "Karnataka": "KAR", "Madhya Pradesh": "MP", "Telangana": "TEL",
    "Delhi": "DEL",
}

ALL_DISTRICTS: list[tuple[str, str]] = [
    (state, district) for state, info in STATES.items() for district in info["districts"]
]


class ProjectTypeProfile:
    def __init__(self, cost_median: float, cost_sigma: float, duration_median_months: float, duration_sigma: float,
                 name_phrase_en: str, lexicon: dict[str, str]):
        self.cost_median = cost_median
        self.cost_sigma = cost_sigma
        self.duration_median_months = duration_median_months
        self.duration_sigma = duration_sigma
        self.name_phrase_en = name_phrase_en
        self.lexicon = lexicon  # language code -> facility phrase in that language/script


PROJECT_TYPE_PROFILES: dict[ProjectType, ProjectTypeProfile] = {
    ProjectType.ROAD: ProjectTypeProfile(
        1_800_000, 0.45, 8, 0.35, "Road Construction",
        {"hi": "सड़क निर्माण", "ta": "சாலை நிர்மாணம்", "bn": "সড়ক নির্মাণ", "te": "రోడ్డు నిర్మాణం"},
    ),
    ProjectType.SCHOOL: ProjectTypeProfile(
        1_200_000, 0.4, 6, 0.3, "School Building",
        {"hi": "विद्यालय भवन", "ta": "பள்ளி கட்டிடம்", "bn": "বিদ্যালয় ভবন", "te": "పాఠశాల భవనం"},
    ),
    ProjectType.COMMUNITY_HALL: ProjectTypeProfile(
        900_000, 0.4, 5, 0.3, "Community Hall",
        {"hi": "सामुदायिक भवन", "ta": "சமூகக் கூடம்", "bn": "সম্প্রদায় ভবন", "te": "సామాజిక భవనం"},
    ),
    ProjectType.WATER_INFRASTRUCTURE: ProjectTypeProfile(
        1_500_000, 0.45, 7, 0.35, "Drinking Water Supply Scheme",
        {"hi": "पेयजल आपूर्ति योजना", "ta": "குடிநீர் வழங்கல் திட்டம்", "bn": "পানীয় জল সরবরাহ প্রকল্প",
         "te": "తాగునీటి సరఫరా పథకం"},
    ),
    ProjectType.HEALTH_CENTRE: ProjectTypeProfile(
        2_200_000, 0.4, 9, 0.3, "Primary Health Centre",
        {"hi": "प्राथमिक स्वास्थ्य केंद्र", "ta": "ஆரம்ப சுகாதார நிலையம்", "bn": "প্রাথমিক স্বাস্থ্য কেন্দ্র",
         "te": "ప్రాథమిక ఆరోగ్య కేంద్రం"},
    ),
    ProjectType.SANITATION: ProjectTypeProfile(
        600_000, 0.4, 4, 0.3, "Public Sanitation Complex",
        {"hi": "सार्वजनिक शौचालय परिसर", "ta": "பொது சுகாதார வளாகம்", "bn": "সর্বজনীন স্যানিটেশন কমপ্লেক্স",
         "te": "ప్రజా పారిశుధ్య సముదాయం"},
    ),
    ProjectType.PUBLIC_FACILITY: ProjectTypeProfile(
        1_000_000, 0.4, 6, 0.3, "Public Facility Centre",
        {"hi": "सार्वजनिक सुविधा केंद्र", "ta": "பொது வசதி மையம்", "bn": "সর্বজনীন সুবিধা কেন্দ্র",
         "te": "ప్రజా సౌకర్య కేంద్రం"},
    ),
}

# Romanized spelling variants used for a subset of duplicate-candidate projects,
# to exercise fuzzy/phonetic matching in Phase 3 (not just script differences).
ROMANIZED_VARIANTS: dict[ProjectType, list[str]] = {
    ProjectType.COMMUNITY_HALL: ["Samudayik Bhawan", "Samudayik Bhavan", "Samudaayik Bhawan"],
    ProjectType.WATER_INFRASTRUCTURE: ["Peyjal Aapurti Yojana", "Peyjal Supply Yojna"],
    ProjectType.HEALTH_CENTRE: ["Prathmik Swasthya Kendra", "Prathamik Swasthya Kendra"],
}

STATUS_WEIGHTS = {"SANCTIONED": 0.08, "ONGOING": 0.42, "DELAYED": 0.14, "COMPLETED": 0.36}

PROJECT_TYPE_WEIGHTS = {
    ProjectType.ROAD: 0.25,
    ProjectType.SCHOOL: 0.20,
    ProjectType.COMMUNITY_HALL: 0.15,
    ProjectType.WATER_INFRASTRUCTURE: 0.15,
    ProjectType.HEALTH_CENTRE: 0.10,
    ProjectType.SANITATION: 0.10,
    ProjectType.PUBLIC_FACILITY: 0.05,
}
