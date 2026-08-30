/**
 * WariMitra AI brain — channel independent.
 *
 * This is the SAME conversational behaviour as the browser call screen
 * (location first → understand → search verified places → speak), but usable
 * from any channel: the REST test endpoint, or a real telephone call arriving
 * through Exotel.
 *
 * Nothing here is invented: facility answers always come from the live Places
 * search in `placesService`, coordinates from Google geocoding. When there is
 * no result, the agent says so.
 */

import {
  AI_ERROR_TEXT,
  SYSTEM_PROMPT,
  composePlacesReply,
  understand,
  type ChatTurn,
  type SpeechLang,
} from "@/services/geminiService";
import {
  resolveSpokenLocation,
  shortLocationLabel,
  type ResolvedLocation,
} from "@/services/locationService";
import {
  CATEGORY_DEFS,
  findNearestFacility,
  normalizeCategory,
  searchNearbyPlaces,
  type PlaceCategory,
} from "@/services/placesService";
import { aiCompleteDirect } from "@/lib/ai.server";
import {
  geocodeDirect,
  nearbySearchDirect,
  placeLookupDirect,
  placePhoneDirect,
} from "@/lib/maps.server";
import { clearTransfer, demoTransferNumber, setConfirmedTransfer, toE164 } from "@/lib/hospital-transfer.server";
import { SEED_MISSING } from "@/data/mockData";
import {
  calculateDistanceKm,
  isWithinAlertRadius,
  MISSING_PERSON_ALERT_RADIUS_KM,
} from "@/services/distanceService";

const phoneLocationProviders = {
  geocode: geocodeDirect,
  placeLookup: placeLookupDirect,
  normalizePlace: async (spoken: string) => {
    const out = await aiCompleteDirect({
      messages: [
        {
          role: "system",
          content:
            "Convert noisy Marathi phone speech into one real Maharashtra place name. Reply only as: Place, Maharashtra, India. Reply NONE if absent.",
        },
        { role: "user", content: spoken.slice(0, 300) },
      ],
    });
    const text = out.text.trim().split("\n")[0]?.trim() ?? "";
    return !text || /^none$/i.test(text) ? null : text.slice(0, 120);
  },
};

export type Lang = SpeechLang;

export function toLang(input?: string | null): Lang {
  const v = (input ?? "").toLowerCase();
  if (v.startsWith("hi")) return "hi-IN";
  if (v.startsWith("en")) return "en-IN";
  return "mr-IN";
}

const T = {
  greeting: {
    "mr-IN":
      "नमस्कार, वारीमित्र मदत केंद्र. तुम्ही सध्या कोणत्या गावाजवळ किंवा कोणत्या ठिकाणी आहात?",
    "hi-IN": "नमस्ते, वारीमित्र सहायता केंद्र. आप इस समय किस गाँव या जगह के पास हैं?",
    "en-IN": "Namaskar, WariMitra helpline. Which village or place are you near right now?",
  },
  askLocation: {
    "mr-IN": "तुम्ही सध्या कोणत्या गावाजवळ किंवा कोणत्या ठिकाणी आहात?",
    "hi-IN": "आप इस समय किस गाँव या जगह के पास हैं?",
    "en-IN": "Which village or place are you near right now?",
  },
  askLocationAgain: {
    "mr-IN": "मला ते ठिकाण सापडले नाही. जवळचे गाव, मंदिर किंवा टोल नाका सांगा.",
    "hi-IN": "वह जगह नहीं मिली. नज़दीकी गाँव, मंदिर या टोल नाका बताइए.",
    "en-IN": "I could not find that place. Please say a nearby village, temple or toll plaza.",
  },
  askLocationWithDistrict: {
    "mr-IN": "ठीक आहे. कृपया गावाचे नाव तालुका किंवा जिल्ह्यासह पुन्हा सांगा.",
    "hi-IN": "ठीक है। कृपया गाँव का नाम तहसील या ज़िले के साथ फिर बताइए।",
    "en-IN": "Okay. Please say the village again with its taluka or district.",
  },
  howHelp: {
    "mr-IN": "आता तुम्हाला कशाची मदत हवी आहे?",
    "hi-IN": "अब आपको किसकी मदद चाहिए?",
    "en-IN": "Now, how can I help you?",
  },
  offerConnect: {
    "mr-IN": "तुम्हाला या हॉस्पिटलशी जोडायचे आहे का?",
    "hi-IN": "क्या आप इस अस्पताल से जुड़ना चाहते हैं?",
    "en-IN": "Would you like me to connect you to this hospital?",
  },
  connecting: {
    "mr-IN": "ठीक आहे, मी तुम्हाला हॉस्पिटलशी जोडत आहे.",
    "hi-IN": "ठीक है, मैं आपको अस्पताल से जोड़ रहा हूँ.",
    "en-IN": "Alright, I am connecting you to the hospital.",
  },
  transferUnavailable: {
    "mr-IN": "हॉस्पिटलशी संपर्क झाला नाही. कृपया दुसरे हॉस्पिटल शोधायचे आहे का?",
    "hi-IN": "अस्पताल से संपर्क नहीं हो सका. क्या दूसरा अस्पताल ढूँढें?",
    "en-IN": "I could not reach that hospital. Shall I look for another one?",
  },
  askCategory: {
    "mr-IN": "तुम्हाला काय हवं आहे? शौचालय, पाणी, दवाखाना, औषधाचे दुकान की जेवण?",
    "hi-IN": "आपको क्या चाहिए? शौचालय, पानी, दवाखाना, दवा की दुकान या भोजन?",
    "en-IN": "What do you need? Toilet, water, medical help, pharmacy or food?",
  },
  searchFailed: {
    "mr-IN": "सध्या जवळच्या ठिकाणांची माहिती मिळवण्यात अडचण येत आहे. कृपया पुन्हा सांगा.",
    "hi-IN": "अभी नज़दीकी जगहों की जानकारी लेने में दिक्कत आ रही है. कृपया दोबारा बताइए.",
    "en-IN": "I am having trouble fetching nearby places. Please say that again.",
  },
  emergency: {
    "mr-IN": "ही आपत्कालीन परिस्थिती वाटते. मी जवळची वैद्यकीय मदत लगेच शोधतो.",
    "hi-IN": "यह आपातकालीन स्थिति लगती है. मैं तुरंत नज़दीकी चिकित्सा मदद खोजता हूँ.",
    "en-IN": "This sounds like an emergency. I am finding the nearest medical help now.",
  },
  emergencyNoLoc: {
    "mr-IN": "ही आपत्कालीन परिस्थिती वाटते. तुम्ही नेमके कुठे आहात ते लगेच सांगा.",
    "hi-IN": "यह आपातकालीन स्थिति लगती है. आप कहाँ हैं यह तुरंत बताइए.",
    "en-IN": "This sounds like an emergency. Tell me exactly where you are, quickly.",
  },
  missingAsk: {
    "mr-IN": "मी माहिती नोंदवतो. हरवलेल्या वारकऱ्याचे नाव, वय आणि कपडे सांगा.",
    "hi-IN": "मैं जानकारी दर्ज करता हूँ. लापता वारकरी का नाम, उम्र और कपड़े बताइए.",
    "en-IN": "I will record the details. Tell me the missing Warkari's name, age and clothing.",
  },
  missingDone: {
    "mr-IN": "माहिती नोंदवली आहे. या भागातील वारीमित्र कॉलर्सना ही सूचना दिली जाईल. काळजी करू नका.",
    "hi-IN": "जानकारी दर्ज कर ली गई है. इस इलाक़े के कॉलर्स को सूचना दी जाएगी.",
    "en-IN": "Details recorded. Callers near that location will hear this alert.",
  },
  bye: {
    "mr-IN": "धन्यवाद. वारी सुखरूप होवो. राम कृष्ण हरी.",
    "hi-IN": "धन्यवाद. आपकी यात्रा शुभ हो.",
    "en-IN": "Thank you. Have a safe journey.",
  },
  empty: {
    "mr-IN": "मला ऐकू आले नाही. कृपया पुन्हा सांगा.",
    "hi-IN": "सुनाई नहीं दिया. कृपया दोबारा बोलिए.",
    "en-IN": "I did not hear that. Please say it again.",
  },
} as const;


function confirmLocation(lang: Lang, location: ResolvedLocation): string {
  const label = shortLocationLabel(location);
  if (lang === "hi-IN") return `मुझे ${label} जगह मिली है। क्या यह सही है?`;
  if (lang === "en-IN") return `I found ${label}. Is that the correct place?`;
  return `मला ${label} हे ठिकाण सापडले आहे. हे बरोबर आहे का?`;
}

function nearbyMissingAlert(lang: Lang, location: ResolvedLocation): string {
  const eligible = SEED_MISSING.filter(
    (person) =>
      person.status === "SEARCHING" &&
      person.lastKnownLatitude != null &&
      person.lastKnownLongitude != null,
  )
    .map((person) => ({
      person,
      distanceKm: calculateDistanceKm(
        location.latitude,
        location.longitude,
        person.lastKnownLatitude ?? 0,
        person.lastKnownLongitude ?? 0,
      ),
    }))
    .filter(({ person, distanceKm }) =>
      isWithinAlertRadius(distanceKm, person.alertRadiusKm ?? MISSING_PERSON_ALERT_RADIUS_KM),
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  if (!eligible) return "";
  const distance = Math.round(eligible.distanceKm);
  const lastKnown = eligible.person.lastKnownLocationText ?? eligible.person.lastSeen;
  if (lang === "hi-IN") {
    return `प्रोटोटाइप सूचना: 100 किलोमीटर के दायरे में ${eligible.person.name}, उम्र ${eligible.person.age}, की डेमो लापता रिपोर्ट है। अंतिम स्थान ${lastKnown}, लगभग ${distance} किलोमीटर दूर। यह आधिकारिक आपातकालीन सूचना नहीं है।`;
  }
  if (lang === "en-IN") {
    return `Prototype notice: there is a demo missing-person report within 100 kilometres for ${eligible.person.name}, age ${eligible.person.age}. Last known near ${lastKnown}, about ${distance} kilometres away. This is not an official emergency alert.`;
  }
  return `प्रोटोटाइप सूचना: 100 किलोमीटरच्या परिसरात ${eligible.person.name}, वय ${eligible.person.age}, यांची हरवल्याची डेमो नोंद आहे. शेवटचे ठिकाण ${lastKnown}, तुमच्यापासून सुमारे ${distance} किलोमीटर. ही अधिकृत आपत्कालीन सूचना नाही.`;
}

/**
 * The alert is an aside: it must never be the last thing the caller hears,
 * otherwise the call feels finished. Always end on the "how can I help" ask.
 */
function acceptedLocationReply(s: Session, location: ResolvedLocation): string {
  const label = shortLocationLabel(location);
  const found =
    s.lang === "hi-IN"
      ? `आपकी जगह ${label} मिली है।`
      : s.lang === "en-IN"
        ? `I found your location as ${label}.`
        : `तुमचे ठिकाण ${label} सापडले आहे.`;
  const ask =
    s.lang === "hi-IN"
      ? "अब आपको किसकी मदद चाहिए? दवाखाना, शौचालय, पीने का पानी, दुकान या लापता व्यक्ति?"
      : s.lang === "en-IN"
        ? "Now, what do you need? Medical help, a toilet, drinking water, a shop, or a missing person?"
        : "आता तुम्हाला कशाची मदत हवी आहे? दवाखाना, शौचालय, पिण्याचे पाणी, दुकान की हरवलेली व्यक्ती?";
  const alert = nearbyMissingAlert(s.lang, location);
  return `${found}${alert ? ` ${alert}` : ""} ${ask}`;
}

function hasLocationWordsBeyondCategory(text: string, category: PlaceCategory): boolean {
  let remainder = text.toLowerCase();
  for (const alias of CATEGORY_DEFS[category].aliases) {
    remainder = remainder.replaceAll(alias.toLowerCase(), " ");
  }
  remainder = remainder
    .replace(
      /(मला|आम्हाला|हवे|हवा|हवी|पाहिजे|कुठे|कोठे|सांगा|शोधा|जवळचे|जवळचा|जवळची|आहे|आहेत|काय|कुठला|कुठली|कुठले|please|need|want|where|find|nearest|nearby|tell|me|is|the|a)/gi,
      " ",
    )
    .replace(/[.,!?।]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return remainder.length >= 2;
}

const YES_WORDS =
  /(^|[\s,.!?।])(हो|होय|हौ|हा|हां|हाँ|हो\s*का|बरोबर|बरोबरे|बराबर|खरं|खरे|योग्य|तेच|तेथेच|तिथेच|जोडा|जोड|चालेल|नक्की|ठीक|ठीके|ओके|हांजी|होजी|ho|hoy|haa|ha|han|haan|hoy?a|barobar|barabar|bro?bar|sahi|thik|theek|ok|okay|okey|yes|yeah|yep|ya|correct|right|true|please\s+connect|connect)([\s,.!?।]|$)/i;
const NO_WORDS =
  /(^|[\s,.!?।])(नको|नाही|नाय|नही|नहीं|चुक|चुकीचं|चुकीचे|चुकलं|वेगळं|वेगळे|नाहीये|nako|nahi|nay|nahin|no|nope|not|wrong|galat|cancel|रद्द)([\s,.!?।]|$)/i;

/**
 * Phone transcripts drop diacritics and mix scripts, so a plain regex misses
 * many natural confirmations. Normalise before matching and treat a short
 * utterance containing a confirm word as a yes.
 */
function normalizeReply(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[.,!?।]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isAffirmative(text: string): boolean {
  const t = normalizeReply(text);
  if (!t) return false;
  if (NO_WORDS.test(` ${t} `)) return false;
  return YES_WORDS.test(` ${t} `);
}

export function isNegative(text: string): boolean {
  return NO_WORDS.test(` ${normalizeReply(text)} `);
}


const EMERGENCY_WORDS =
  /(इमर्जन्सी|emergency|अपघात|accident|बेशुद्ध|चक्कर|छाती|हार्ट|heart|श्वास|रक्त|blood|सिरियस|serious|वाचवा|मदत करा|ambulance|रुग्णवाहिका)/i;

export interface Session {
  id: string;
  lang: Lang;
  history: ChatTurn[];
  location?: ResolvedLocation | undefined;
  flow: "none" | "await_location" | "await_location_confirm" | "missing" | "await_transfer_confirm";
  pendingCategory?: PlaceCategory | undefined;
  pendingLocation?: ResolvedLocation | undefined;
  missing: string[];
  /** Verified E.164 hospital number offered to the caller, pending consent. */
  offeredHospital?: { name: string; number: string } | undefined;
  updatedAt: number;
}

/**
 * In-memory session store. Fine for a hackathon MVP (one call = one session,
 * a few minutes long). Swap for a durable store if calls must survive a
 * server restart.
 */
const SESSIONS = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function sweep() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of SESSIONS) if (s.updatedAt < cutoff) SESSIONS.delete(id);
}

export function getSession(id: string, lang: Lang = "mr-IN"): Session {
  sweep();
  let s = SESSIONS.get(id);
  if (!s) {
    s = { id, lang, history: [], flow: "await_location", missing: [], updatedAt: Date.now() };
    SESSIONS.set(id, s);
  }
  s.updatedAt = Date.now();
  return s;
}

export function endSession(id: string) {
  SESSIONS.delete(id);
}

export function greeting(lang: Lang = "mr-IN"): string {
  return T.greeting[lang];
}

export interface TurnResult {
  answer: string;
  intent: string;
  location: { text: string; latitude: number; longitude: number; confidence: string } | null;
  place: { name: string; address: string; distanceM: number } | null;
  endCall: boolean;
  /** True once the caller confirmed: hang up the bot leg after this reply. */
  transfer?: boolean;
}

/**
 * A hospital can only be offered for transfer when a phone number is actually
 * published. Nearby search often omits it, so we (1) ask Places Details for the
 * nearest result, and (2) fall back to the closest other hospital that does
 * publish a number. Nothing is invented — only verified Places numbers are used.
 */
async function findCallableHospital(
  latitude: number,
  longitude: number,
  cat: PlaceCategory,
  nearest: { id: string; name: string; phone?: string | null },
): Promise<{ name: string; number: string } | null> {
  // Prototype demo routing: a single test receptionist line for every hospital.
  const demo = demoTransferNumber();
  if (demo) return { name: nearest.name, number: demo };

  const direct = toE164(nearest.phone);
  if (direct) return { name: nearest.name, number: direct };

  const detail = toE164(await placePhoneDirect(nearest.id).catch(() => null));
  if (detail) return { name: nearest.name, number: detail };

  const candidates = await searchNearbyPlaces(
    latitude,
    longitude,
    cat,
    15000,
    nearbySearchDirect,
  ).catch(() => []);
  for (const place of candidates.slice(0, 6)) {
    if (place.id === nearest.id) continue;
    const listed = toE164(place.phone);
    if (listed) return { name: place.name, number: listed };
    const looked = toE164(await placePhoneDirect(place.id).catch(() => null));
    if (looked) return { name: place.name, number: looked };
  }
  return null;
}

/** Search a verified nearby facility and word the answer. */
async function answerFacility(s: Session, cat: PlaceCategory, extra?: string): Promise<TurnResult> {
  const loc = s.location;
  if (!loc) return plain(s, T.askLocation[s.lang], CATEGORY_DEFS[cat].english);
  const nearest = await findNearestFacility(
    loc.latitude,
    loc.longitude,
    cat,
    nearbySearchDirect,
  ).catch(() => null);
  const spoken = await composePlacesReply(
    s.history,
    s.lang,
    shortLocationLabel(loc),
    nearest
      ? {
          name: nearest.name,
          categoryLabel: nearest.categoryLabel,
          address: nearest.address,
          distanceM: nearest.distanceM,
          openNow: nearest.openNow,
        }
      : null,
    extra,
    aiCompleteDirect,
  ).catch(() => null);

  const fallback = nearest
    ? s.lang === "en-IN"
      ? `${nearest.name} is about ${nearest.distanceM} metres from you.`
      : `${nearest.name} — तुमच्यापासून सुमारे ${nearest.distanceM} मीटर अंतरावर आहे.`
    : T.searchFailed[s.lang];

  let answer = spoken || fallback;
  s.offeredHospital = undefined;
  if (nearest && (cat === "hospital" || cat === "medical")) {
    const contact = await findCallableHospital(loc.latitude, loc.longitude, cat, nearest).catch(
      () => null,
    );
    if (contact) {
      s.offeredHospital = contact;
      s.flow = "await_transfer_confirm";
      answer = `${answer} ${T.offerConnect[s.lang]}`;
      console.log("[transfer] transfer offered");
    } else {
      console.log("[transfer] no published number for nearby hospitals");
    }
  }

  return {
    answer,
    intent: CATEGORY_DEFS[cat].english,
    location: locOut(loc),
    place: nearest
      ? { name: nearest.name, address: nearest.address, distanceM: nearest.distanceM }
      : null,
    endCall: false,
  };
}

function locOut(loc?: ResolvedLocation) {
  if (!loc) return null;
  return {
    text: shortLocationLabel(loc),
    latitude: loc.latitude,
    longitude: loc.longitude,
    confidence: loc.confidence,
  };
}

function plain(s: Session, answer: string, intent: string, endCall = false): TurnResult {
  return { answer, intent, location: locOut(s.location), place: null, endCall };
}

/**
 * One conversation turn. `message` is what the caller said (already
 * transcribed). Everything is wrapped so the caller always gets a speakable
 * Marathi sentence, never an exception.
 */
export async function handleTurn(input: {
  sessionId: string;
  message: string;
  language?: string | undefined;
  location?: { latitude: number; longitude: number } | undefined;
}): Promise<TurnResult> {
  const s = getSession(input.sessionId, toLang(input.language));
  if (input.language) s.lang = toLang(input.language);

  const text = (input.message ?? "").trim();
  if (!text) return plain(s, T.empty[s.lang], "empty");

  // Browser channel may supply real GPS; phone calls never do.
  if (input.location && !s.location) {
    s.location = {
      text: "Caller supplied coordinates",
      spokenText: "",
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      confidence: "high",
      resolvedAt: new Date().toISOString(),
    };
    s.flow = "none";
  }

  s.history.push({ role: "user", text });

  try {
    const result = await runTurn(s, text);
    s.history.push({ role: "assistant", text: result.answer });
    return result;
  } catch (err) {
    console.error("WariMitra turn failed", err);
    const answer = AI_ERROR_TEXT[s.lang];
    s.history.push({ role: "assistant", text: answer });
    return plain(s, answer, "error");
  }
}

async function runTurn(s: Session, text: string): Promise<TurnResult> {
  if (s.flow === "await_location_confirm") {
    const pending = s.pendingLocation;
    if (pending && isAffirmative(text)) {
      s.location = pending;
      s.pendingLocation = undefined;
      s.flow = "none";
      const category = s.pendingCategory;
      s.pendingCategory = undefined;
      if (category) {
        const result = await answerFacility(s, category);
        const alert = nearbyMissingAlert(s.lang, pending);
        return alert ? { ...result, answer: `${alert} ${result.answer}` } : result;
      }
      return plain(s, acceptedLocationReply(s, pending), "location");
    }
    if (isNegative(text)) {
      s.pendingLocation = undefined;
      s.flow = "await_location";
      return plain(s, T.askLocationWithDistrict[s.lang], "need_location");
    }
    return plain(
      s,
      pending ? confirmLocation(s.lang, pending) : T.askLocationAgain[s.lang],
      "location_confirmation",
    );
  }

  const emergency = EMERGENCY_WORDS.test(text);

  // Deterministic emergency path — never left to the model alone.
  if (emergency) {
    if (!s.location) {
      const resolved = await resolveSpokenLocation(text, phoneLocationProviders).catch(() => null);
      if (resolved) s.location = resolved;
    }
    if (!s.location) {
      s.flow = "await_location";
      s.pendingCategory = "medical";
      return plain(s, T.emergencyNoLoc[s.lang], "emergency");
    }
    const out = await answerFacility(s, "medical", "This caller may have a medical emergency.");
    return { ...out, answer: `${T.emergency[s.lang]} ${out.answer}`, intent: "Emergency" };
  }

  // Waiting for the caller's location (asked at call start).
  if (s.flow === "await_location" || !s.location) {
    // Resolve the whole utterance before treating it as need-only. Callers
    // naturally say both facts together ("मी जेजुरीला आहे, हॉस्पिटल कुठे आहे").
    // The previous order discarded the village as soon as it saw "hospital".
    const stated = normalizeCategory(text);
    const shouldResolve =
      !stated || Boolean(s.pendingCategory) || hasLocationWordsBeyondCategory(text, stated);
    const resolved = shouldResolve
      ? await resolveSpokenLocation(text, phoneLocationProviders).catch(() => null)
      : null;
    if (resolved) {
      s.pendingLocation = resolved;
      s.pendingCategory = stated ?? s.pendingCategory;
      s.flow = "await_location_confirm";
      return plain(s, confirmLocation(s.lang, resolved), "location_confirmation");
    }
    // No resolvable location: retain a stated need and ask only for location.
    if (stated) {
      s.pendingCategory = stated;
      s.flow = "await_location";
      return plain(s, T.askLocation[s.lang], CATEGORY_DEFS[stated].english);
    }
    s.flow = "await_location";
    return plain(s, T.askLocationAgain[s.lang], "need_location");
  }

  // Consent gate for a hospital transfer. Only an explicit yes transfers.
  if (s.flow === "await_transfer_confirm") {
    const offered = s.offeredHospital;
    s.flow = "none";
    s.offeredHospital = undefined;
    if (offered && isAffirmative(text)) {
      setConfirmedTransfer(s.id, offered.number);
      console.log("[transfer] transfer confirmed");
      console.log("[transfer] transfer number ready");
      return { ...plain(s, T.connecting[s.lang], "hospital_transfer"), transfer: true };
    }
    clearTransfer(s.id);
    if (!offered) return plain(s, T.transferUnavailable[s.lang], "hospital_transfer");
    if (isNegative(text)) return plain(s, T.howHelp[s.lang], "hospital_transfer_declined");
    // Not a clear yes/no — treat the utterance as a fresh request below.
  }

  // Missing Warkari details capture (kept simple for the phone channel).
  if (s.flow === "missing") {
    s.missing.push(text);
    if (s.missing.length < 2) return plain(s, T.missingAsk[s.lang], "Missing");
    s.flow = "none";
    return plain(s, `${T.missingDone[s.lang]} ${T.howHelp[s.lang]}`, "Missing");
  }

  // Fast path: the caller clearly named a facility and we already know where
  // they are. Answer straight from the live Places search instead of paying
  // for a model round-trip first — this keeps phone turns snappy and works
  // even if the model is slow or unavailable.
  const directCat = normalizeCategory(text);
  if (directCat) return answerFacility(s, directCat);

  // Normal turn: let Gemini understand, then answer from verified data.
  const nlu = await understand(
    s.history,
    s.lang,
    {
      callerLocationText: s.location ? shortLocationLabel(s.location) : undefined,
      callerLocationConfidence: s.location?.confidence,
      facilityType: undefined,
      activeFlow: s.flow,
    },
    aiCompleteDirect,
  );
  if (nlu.responseLanguage) s.lang = nlu.responseLanguage;

  if (nlu.intent === "goodbye") return plain(s, T.bye[s.lang], "Goodbye", true);

  if (nlu.intent === "location_changed" || nlu.intent === "provide_location") {
    const resolved = await resolveSpokenLocation(
      nlu.locationMentioned || text,
      phoneLocationProviders,
    ).catch(() => null);
    if (resolved) {
      s.pendingLocation = resolved;
      s.flow = "await_location_confirm";
    }
    return plain(
      s,
      resolved ? confirmLocation(s.lang, resolved) : T.askLocationAgain[s.lang],
      "location",
    );
  }

  if (nlu.intent === "missing_person") {
    s.flow = "missing";
    s.missing = [];
    return plain(s, T.missingAsk[s.lang], "Missing");
  }

  const cat = normalizeCategory(nlu.facilityType) ?? normalizeCategory(text);
  if (nlu.intent === "find_facility" || cat) {
    if (!cat) return plain(s, T.askCategory[s.lang], "find_facility");
    return answerFacility(s, cat);
  }

  // General conversation — Gemini's own wording, no invented facts.
  return plain(s, nlu.response || T.howHelp[s.lang], nlu.intent);
}

export const warimitraCore = { handleTurn, greeting, getSession, endSession, SYSTEM_PROMPT };
