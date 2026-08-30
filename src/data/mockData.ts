export type FacilityCategory =
  "Medical" | "Toilet" | "Water" | "Food" | "Pharmacy" | "Rest" | "Police" | "Charging";

export type FacilityStatus = "OPEN" | "BUSY" | "CLOSED";

export interface Facility {
  id: string;
  name: string;
  category: FacilityCategory;
  /** Village / town along the Wari route */
  location: string;
  /** Nearest recognisable landmark a caller is likely to say out loud */
  landmark: string;
  /** Approximate walking distance from that landmark, in metres */
  distanceM: number;
  status: FacilityStatus;
  openingHours: string;
  lat: number;
  lng: number;
  updatedAt: string;
  note?: string;
}

export type LocationConfidenceLevel = "high" | "medium" | "low";

export interface MissingPerson {
  id: string;
  name: string;
  age: number;
  gender: string;
  clothing: string;
  height: string;
  /** Human readable last-known location (kept for existing screens). */
  lastSeen: string;
  dindi: string;
  /** Legacy free-text contact field. */
  contact: string;
  description: string;
  status: "SEARCHING" | "FOUND";
  createdAt: string;
  sightings: Sighting[];

  // ---- Location-aware alerting (added in the geo upgrade) ----
  appearance?: string;
  distinguishingFeatures?: string;
  lastKnownLocationText?: string;
  lastKnownLatitude?: number;
  lastKnownLongitude?: number;
  locationConfidence?: LocationConfidenceLevel;
  lastLocationUpdatedAt?: string;
  /** Never displayed publicly — masked in every UI. */
  reporterPhoneNumber?: string;
  alertRadiusKm?: number;
}

export interface Sighting {
  id: string;
  personId: string;
  location: string;
  timeSeen: string;
  info: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  locationConfidence?: LocationConfidenceLevel;
  callerPhoneNumber?: string;
  distanceFromLastKnownKm?: number;
}


export type AnnouncementType =
  | "Weather Alert"
  | "Route Diversion"
  | "Medical Camp Update"
  | "Crowd Alert"
  | "Food Distribution Update";

export interface Announcement {
  id: string;
  type: AnnouncementType;
  message: string;
  location: string;
  createdAt: string;
}

export interface CallRecord {
  id: string;
  intent: string;
  language: string;
  location: string;
  createdAt: string;
}

export interface WariLocation {
  name: string;
  marathi: string;
  x: number; // percentage on the mock map panel
  y: number;
}

export const LOCATIONS: WariLocation[] = [
  { name: "Saswad", marathi: "सासवड", x: 14, y: 24 },
  { name: "Jejuri", marathi: "जेजुरी", x: 32, y: 42 },
  { name: "Yavat", marathi: "यवत", x: 52, y: 30 },
  { name: "Wakhari", marathi: "वाखरी", x: 72, y: 62 },
  { name: "Pandharpur", marathi: "पंढरपूर", x: 88, y: 78 },
];

const now = Date.now();
const mins = (m: number) => new Date(now - m * 60_000).toISOString();

/** Compact builder so the prototype demo data stays readable. */
function f(
  id: string,
  name: string,
  category: FacilityCategory,
  location: string,
  landmark: string,
  distanceM: number,
  status: FacilityStatus,
  openingHours: string,
  lat: number,
  lng: number,
  ago: number,
): Facility {
  return {
    id,
    name,
    category,
    location,
    landmark,
    distanceM,
    status,
    openingHours,
    lat,
    lng,
    updatedAt: mins(ago),
  };
}

/**
 * PROTOTYPE DEMO DATA — not official Wari data.
 * Replace with a FastAPI/PostgreSQL source later; the service layer shape stays the same.
 */
export const SEED_FACILITIES: Facility[] = [
  // ---- Jejuri ----
  f("toilet-001", "Public Toilet — Jejuri Toll Plaza", "Toilet", "Jejuri", "Jejuri Toll Plaza", 600, "OPEN", "24 hours", 18.2765, 74.1583, 12),
  f("medical-001", "Primary Medical Camp", "Medical", "Jejuri", "Jejuri Toll Plaza", 450, "OPEN", "24 hours", 18.2769, 74.1602, 8),
  f("water-001", "Drinking Water Tanker Point", "Water", "Jejuri", "Jejuri Toll Plaza", 180, "OPEN", "5 AM – 11 PM", 18.2775, 74.1571, 5),
  f("toilet-002", "Wari Mobile Toilet Block A", "Toilet", "Jejuri", "Jejuri Bus Stand", 220, "OPEN", "24 hours", 18.2781, 74.1588, 14),
  f("food-001", "Annadan Bhojan Centre", "Food", "Jejuri", "Jejuri Bus Stand", 700, "BUSY", "6 AM – 10 PM", 18.2752, 74.1625, 22),
  f("pharmacy-001", "Jejuri Seva Pharmacy", "Pharmacy", "Jejuri", "Khandoba Temple Road", 900, "OPEN", "7 AM – 11 PM", 18.2741, 74.1649, 31),
  f("rest-001", "Dindi Rest Camp 12", "Rest", "Jejuri", "Khandoba Temple Road", 1200, "OPEN", "24 hours", 18.2718, 74.1662, 44),
  f("police-001", "Police Help Point", "Police", "Jejuri", "Jejuri Bus Stand", 600, "OPEN", "24 hours", 18.2795, 74.1611, 11),
  f("charging-001", "Mobile Charging Kiosk", "Charging", "Jejuri", "Jejuri Toll Plaza", 850, "BUSY", "6 AM – 11 PM", 18.2733, 74.1594, 17),

  // ---- Saswad ----
  f("medical-002", "Saswad Community Health Camp", "Medical", "Saswad", "Saswad Bus Stand", 380, "OPEN", "24 hours", 18.3469, 74.032, 9),
  f("water-002", "Saswad Water Station", "Water", "Saswad", "Sopan Kaka Samadhi Mandir", 260, "OPEN", "5 AM – 11 PM", 18.348, 74.0338, 6),
  f("toilet-003", "Saswad Toilet Block C", "Toilet", "Saswad", "Saswad Bus Stand", 340, "BUSY", "24 hours", 18.3452, 74.0352, 19),
  f("rest-002", "Saswad Rest Shelter", "Rest", "Saswad", "Sopan Kaka Samadhi Mandir", 950, "OPEN", "24 hours", 18.344, 74.0371, 37),

  // ---- Yavat ----
  f("medical-003", "Yavat Medical Aid Post", "Medical", "Yavat", "Yavat Highway Chowk", 520, "OPEN", "24 hours", 18.4551, 74.2233, 12),
  f("water-003", "Yavat Drinking Water Point", "Water", "Yavat", "Yavat Highway Chowk", 150, "OPEN", "5 AM – 11 PM", 18.4562, 74.2211, 4),
  f("food-002", "Yavat Bhakti Bhojanalay", "Food", "Yavat", "Yavat Palkhi Tal", 640, "OPEN", "6 AM – 10 PM", 18.4535, 74.2248, 26),
  f("toilet-004", "Yavat Toilet Block B", "Toilet", "Yavat", "Yavat Palkhi Tal", 300, "CLOSED", "Under maintenance", 18.4571, 74.2265, 52),
  f("charging-002", "Yavat Charging Kiosk", "Charging", "Yavat", "Yavat Highway Chowk", 400, "OPEN", "6 AM – 11 PM", 18.4544, 74.2199, 33),

  // ---- Wakhari ----
  f("medical-004", "Wakhari Ringan Medical Camp", "Medical", "Wakhari", "Wakhari Ringan Ground", 410, "OPEN", "24 hours", 17.6892, 75.3021, 7),
  f("water-004", "Wakhari Water Tanker Line", "Water", "Wakhari", "Wakhari Ringan Ground", 200, "BUSY", "5 AM – 11 PM", 17.6905, 75.3009, 13),
  f("police-002", "Wakhari Police Chowki", "Police", "Wakhari", "Wakhari Bypass Road", 720, "OPEN", "24 hours", 17.6878, 75.3044, 21),
  f("charging-003", "Wakhari Charging Point", "Charging", "Wakhari", "Wakhari Bypass Road", 480, "OPEN", "6 AM – 11 PM", 17.6866, 75.3032, 29),
  f("toilet-005", "Wakhari Mobile Toilet Row", "Toilet", "Wakhari", "Wakhari Ringan Ground", 260, "OPEN", "24 hours", 17.6899, 75.3038, 15),

  // ---- Pandharpur ----
  f("medical-005", "Pandharpur Civil Medical Camp", "Medical", "Pandharpur", "Vitthal Mandir", 350, "OPEN", "24 hours", 17.6799, 75.3233, 3),
  f("water-005", "Chandrabhaga Water Point", "Water", "Pandharpur", "Chandrabhaga Ghat", 240, "OPEN", "24 hours", 17.6784, 75.3251, 10),
  f("food-003", "Pandharpur Mahaprasad Centre", "Food", "Pandharpur", "Vitthal Mandir", 560, "BUSY", "6 AM – 10 PM", 17.6761, 75.3272, 16),
  f("pharmacy-002", "Pandharpur Seva Pharmacy", "Pharmacy", "Pandharpur", "Pandharpur Bus Stand", 810, "OPEN", "7 AM – 11 PM", 17.6748, 75.3288, 24),
  f("toilet-006", "Pandharpur Toilet Complex", "Toilet", "Pandharpur", "Chandrabhaga Ghat", 190, "OPEN", "24 hours", 17.6812, 75.3219, 9),
  f("rest-003", "Pandharpur Yatri Rest Hall", "Rest", "Pandharpur", "Pandharpur Bus Stand", 1100, "OPEN", "24 hours", 17.6729, 75.3301, 41),
  f("police-003", "Pandharpur Help Desk", "Police", "Pandharpur", "Vitthal Mandir", 300, "OPEN", "24 hours", 17.6806, 75.3241, 18),
];

/** Landmark aliases so spoken Marathi / Hinglish maps to a known landmark. */
export const LANDMARK_ALIASES: Record<string, string[]> = {
  "Jejuri Toll Plaza": ["jejuri toll plaza", "jejuri toll", "जेजुरी टोल प्लाझा", "जेजुरी टोल", "toll plaza"],
  "Jejuri Bus Stand": ["jejuri bus stand", "jejuri stand", "जेजुरी बस स्टँड", "जेजुरी स्टँड"],
  "Khandoba Temple Road": ["khandoba", "khandoba temple", "खंडोबा", "खंडोबा मंदिर"],
  "Saswad Bus Stand": ["saswad bus stand", "सासवड बस स्टँड", "सासवड स्टँड"],
  "Sopan Kaka Samadhi Mandir": ["sopan kaka", "sopankaka", "सोपानकाका", "सोपान काका"],
  "Yavat Highway Chowk": ["yavat highway", "yavat chowk", "यवत हायवे", "यवत चौक"],
  "Yavat Palkhi Tal": ["yavat palkhi", "palkhi tal", "यवत पालखी", "पालखी तळ"],
  "Wakhari Ringan Ground": ["wakhari ringan", "ringan", "वाखरी रिंगण", "रिंगण"],
  "Wakhari Bypass Road": ["wakhari bypass", "वाखरी बायपास"],
  "Vitthal Mandir": ["vitthal mandir", "vitthal temple", "विठ्ठल मंदिर", "मंदिर"],
  "Chandrabhaga Ghat": ["chandrabhaga", "ghat", "चंद्रभागा", "घाट"],
  "Pandharpur Bus Stand": ["pandharpur bus stand", "पंढरपूर बस स्टँड"],
};

/** Village aliases (Marathi / Hindi / Hinglish spellings). */
export const LOCATION_ALIASES: Record<string, string[]> = {
  Jejuri: ["jejuri", "jejari", "जेजुरी"],
  Saswad: ["saswad", "sasvad", "सासवड"],
  Yavat: ["yavat", "yawat", "यवत"],
  Wakhari: ["wakhari", "vakhari", "वाखरी"],
  Pandharpur: ["pandharpur", "pandarpur", "पंढरपूर", "पंढरपुर"],
};

/**
 * Walking order of the route villages in this prototype, with the approximate
 * walking distance to the NEXT village. Used to estimate where a caller is when
 * they can only say "we left Jejuri about 30 minutes ago".
 * PROTOTYPE DEMO DATA — approximate, not official Wari distances.
 */
export const ROUTE_SEQUENCE: string[] = ["Saswad", "Jejuri", "Yavat", "Wakhari", "Pandharpur"];

export const ROUTE_LEG_KM: Record<string, number> = {
  Saswad: 16,
  Jejuri: 20,
  Yavat: 28,
  Wakhari: 12,
  Pandharpur: 0,
};

/** Typical Warkari walking speed used for the estimate (km/h). */
export const WALKING_KMPH = 4;


export const SEED_MISSING: MissingPerson[] = [
  {
    id: "m1",
    name: "Vitthal Jadhav",
    age: 67,
    gender: "Male",
    clothing: "White Kurta, White Gandhi Cap, Walking Stick",
    height: "5 ft 4 in",
    lastSeen: "Jejuri, Maharashtra",
    dindi: "128",
    contact: "+91 90000 00000 (demo)",
    description:
      "Speaks Marathi. Hard of hearing. Was walking with Dindi 128 near the Jejuri checkpoint.",
    status: "SEARCHING",
    createdAt: mins(46),
    sightings: [],
    appearance: "Elderly, slim build",
    distinguishingFeatures: "Walking stick, hard of hearing",
    lastKnownLocationText: "Jejuri, Maharashtra",
    lastKnownLatitude: 18.2769,
    lastKnownLongitude: 74.1602,
    locationConfidence: "medium",
    reporterPhoneNumber: "9822011245",
    alertRadiusKm: 100,
  },

];

export const SEED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a1",
    type: "Weather Alert",
    message:
      "Light rain expected near Yavat between 4 PM and 7 PM. Rest camps have extra shelter space.",
    location: "Yavat",
    createdAt: mins(35),
  },
];

export const SEED_CALLS: CallRecord[] = [
  { id: "c1", intent: "Medical", language: "Marathi", location: "Jejuri", createdAt: mins(120) },
  { id: "c2", intent: "Water", language: "Marathi", location: "Saswad", createdAt: mins(96) },
  { id: "c3", intent: "Toilet", language: "Hindi", location: "Yavat", createdAt: mins(80) },
  { id: "c4", intent: "Medical", language: "Marathi", location: "Wakhari", createdAt: mins(63) },
  { id: "c5", intent: "Emergency", language: "Marathi", location: "Jejuri", createdAt: mins(52) },
  { id: "c6", intent: "Food", language: "English", location: "Pandharpur", createdAt: mins(40) },
  { id: "c7", intent: "Water", language: "Marathi", location: "Jejuri", createdAt: mins(28) },
  { id: "c8", intent: "Missing", language: "Marathi", location: "Jejuri", createdAt: mins(18) },
];

export const CATEGORY_META: Record<FacilityCategory, { icon: string; marathi: string }> = {
  Medical: { icon: "🩺", marathi: "वैद्यकीय" },
  Toilet: { icon: "🚻", marathi: "शौचालय" },
  Water: { icon: "💧", marathi: "पाणी" },
  Food: { icon: "🍚", marathi: "अन्नदान" },
  Pharmacy: { icon: "💊", marathi: "औषधालय" },
  Rest: { icon: "⛺", marathi: "विश्रांती" },
  Police: { icon: "🛡️", marathi: "पोलीस" },
  Charging: { icon: "🔌", marathi: "चार्जिंग" },
};
