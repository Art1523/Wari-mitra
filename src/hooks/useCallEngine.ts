import { useCallback, useEffect, useRef, useState } from "react";
import { announcementService } from "@/services/announcementService";
import { missingPersonService, maskPhone } from "@/services/missingPersonService";
import { voiceService } from "@/services/voiceService";
import { uid } from "@/services/storage";
import {
  resolveSpokenLocation,
  shortLocationLabel,
  normalizeDigits,
  type ResolvedLocation,
} from "@/services/locationService";
import {
  findNearestFacility,
  normalizeCategory,
  searchFacilitiesByCategory,
  CATEGORY_DEFS,
  type NearbyFacility,
  type PlaceCategory,
} from "@/services/placesService";
import { formatDistance } from "@/services/distanceService";
import {
  AI_ERROR_TEXT,
  composePlacesReply,
  understand,
  type ChatTurn,
  type SpeechLang,
} from "@/services/geminiService";
import { useListener, useSpeaker } from "./useSpeech";

export type CallState =
  | "IDLE"
  | "CALLING"
  | "CONNECTED"
  | "SPEAKING"
  | "LISTENING"
  | "TRANSCRIBING"
  | "PROCESSING"
  | "ENDED";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
}

type MissingStep = "name" | "age" | "appearance" | "lastSeen" | "phone";

type Flow =
  | { kind: "none" }
  | { kind: "await_location" }
  | { kind: "missing"; step: MissingStep; data: Record<string, string>; loc?: ResolvedLocation }
  | { kind: "sighting"; personId: string };

const T = {
  greeting: {
    "mr-IN":
      "नमस्कार, वारीमित्र मदत केंद्र. सर्वात आधी, तुम्ही सध्या कुठे आहात? जवळचे गाव, मंदिर, टोल नाका किंवा ओळखीची जागा सांगा.",
    "hi-IN":
      "नमस्ते, वारीमित्र सहायता केंद्र. सबसे पहले, आप इस समय कहाँ हैं? नज़दीकी गाँव, मंदिर या टोल नाका बताइए.",
    "en-IN":
      "Namaskar, this is the WariMitra helpline. First of all, where are you right now? Tell me a nearby village, temple or toll plaza.",
  },
  askLocationAgain: {
    "mr-IN": "तुमच्या जवळ एखादे गाव, मंदिर, टोल नाका किंवा बस स्टँड आहे का?",
    "hi-IN": "आपके पास कोई गाँव, मंदिर, टोल नाका या बस स्टैंड है क्या?",
    "en-IN": "Is there a village, temple, toll plaza or bus stand near you?",
  },
  askDirection: {
    "mr-IN": "तुम्ही पंढरपूरच्या दिशेने जात आहात की पुण्याच्या दिशेने?",
    "hi-IN": "आप पंढरपुर की ओर जा रहे हैं या पुणे की ओर?",
    "en-IN": "Are you heading towards Pandharpur or towards Pune?",
  },
  howHelp: {
    "mr-IN": "आता तुम्हाला कशाची मदत हवी आहे?",
    "hi-IN": "अब आपको किसकी मदद चाहिए?",
    "en-IN": "Now, how can I help you?",
  },
  askAgain: {
    "mr-IN": "क्षमस्व, मला नीट ऐकू आले नाही. कृपया पुन्हा सांगा.",
    "hi-IN": "क्षमा करें, ठीक से सुनाई नहीं दिया. कृपया दोबारा बोलिए.",
    "en-IN": "Sorry, I did not catch that. Please say it again.",
  },
  askCategory: {
    "mr-IN": "तुम्हाला नेमकं काय हवं आहे? शौचालय, पाणी, दवाखाना, औषधाचे दुकान की जेवण?",
    "hi-IN": "आपको क्या चाहिए? शौचालय, पानी, दवाखाना, दवा की दुकान या भोजन?",
    "en-IN": "What exactly do you need? Toilet, water, medical help, pharmacy or food?",
  },
  searchFailed: {
    "mr-IN": "सध्या जवळच्या ठिकाणांची माहिती मिळवण्यात अडचण येत आहे. कृपया पुन्हा प्रयत्न करा.",
    "hi-IN": "अभी नज़दीकी जगहों की जानकारी लेने में दिक्कत आ रही है. कृपया फिर से प्रयास करें.",
    "en-IN": "I am having trouble fetching nearby places right now. Please try again.",
  },
  emergency: {
    "mr-IN": "ही आपत्कालीन परिस्थिती असू शकते. मी जवळची वैद्यकीय मदत शोधतो.",
    "hi-IN": "यह आपातकालीन स्थिति हो सकती है. मैं नज़दीकी चिकित्सा मदद खोजता हूँ.",
    "en-IN": "This may be an emergency. Let me find the nearest medical help.",
  },
  bye: {
    "mr-IN": "धन्यवाद. वारी सुखरूप होवो. राम कृष्ण हरी.",
    "hi-IN": "धन्यवाद. आपकी यात्रा शुभ हो.",
    "en-IN": "Thank you. Have a safe journey.",
  },
  missing: {
    name: {
      "mr-IN": "नक्की, मी त्यांची माहिती नोंदवतो. त्यांचे नाव काय आहे?",
      "hi-IN": "ज़रूर, मैं उनकी जानकारी दर्ज करता हूँ. उनका नाम क्या है?",
      "en-IN": "Of course, I will record their details. What is their name?",
    },
    age: {
      "mr-IN": "त्यांचे वय किती आहे?",
      "hi-IN": "उनकी उम्र कितनी है?",
      "en-IN": "What is their age?",
    },
    appearance: {
      "mr-IN": "त्यांनी कोणते कपडे घातले आहेत आणि दिसायला कसे आहेत?",
      "hi-IN": "उन्होंने कौन से कपड़े पहने हैं और वे दिखने में कैसे हैं?",
      "en-IN": "What are they wearing, and what do they look like?",
    },
    lastSeen: {
      "mr-IN": "ते शेवटचे कुठे दिसले? गाव, मंदिर किंवा टोल नाका सांगा.",
      "hi-IN": "वे आख़िरी बार कहाँ दिखे थे? गाँव, मंदिर या टोल नाका बताइए.",
      "en-IN": "Where were they last seen? Tell me a village, temple or toll plaza.",
    },
    phone: {
      "mr-IN": "त्यांच्याबद्दल माहिती कळवण्यासाठी तुमचा फोन नंबर काय आहे?",
      "hi-IN": "उनके बारे में जानकारी देने के लिए आपका फ़ोन नंबर क्या है?",
      "en-IN": "What is your phone number, so information can reach you?",
    },
    phoneRetry: {
      "mr-IN": "कृपया दहा अंकी फोन नंबर सावकाश सांगा.",
      "hi-IN": "कृपया दस अंकों का फ़ोन नंबर धीरे-धीरे बताइए.",
      "en-IN": "Please say the ten digit phone number slowly.",
    },
    done: {
      "mr-IN":
        "माहिती नोंदवली आहे. या भागातील वारीमित्र कॉलर्सना ही सूचना दिली जाईल आणि कोणी दिसल्यास तुम्हाला कळवले जाईल.",
      "hi-IN":
        "जानकारी दर्ज कर ली गई है. इस इलाक़े के वारीमित्र कॉलर्स को सूचना दी जाएगी.",
      "en-IN":
        "Details recorded. Callers near that location will hear this alert, and any sighting will reach you.",
    },
  },
  sighting: {
    ask: {
      "mr-IN": "तुम्ही त्यांना कुठे पाहिले?",
      "hi-IN": "आपने उन्हें कहाँ देखा?",
      "en-IN": "Where did you see them?",
    },
    none: {
      "mr-IN": "सध्या तुमच्या भागात कोणतीही सक्रिय हरवलेल्या वारकऱ्याची सूचना नाही.",
      "hi-IN": "अभी आपके इलाक़े में कोई सक्रिय लापता वारकरी सूचना नहीं है.",
      "en-IN": "There is no active missing Warkari alert near you right now.",
    },
  },
} as const;

const LANG_NAME: Record<SpeechLang, string> = {
  "mr-IN": "Marathi",
  "hi-IN": "Hindi",
  "en-IN": "English",
};

function parseAge(text: string): number {
  const m = normalizeDigits(text).match(/\d{1,3}/);
  return m ? Number(m[0]) : 0;
}

function parsePhone(text: string): string | null {
  const digits = normalizeDigits(text).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

function alertSentence(
  lang: SpeechLang,
  p: { name: string; age: number; clothing: string; lastKnownLocationText?: string },
  distanceKm: number,
): string {
  const where = p.lastKnownLocationText ?? "";
  if (lang === "en-IN") {
    return `An important alert. ${p.name}, age ${p.age}, ${p.clothing}, was last seen near ${where}, about ${formatDistance(distanceKm)} from you. If you see this person, please tell WariMitra.`;
  }
  if (lang === "hi-IN") {
    return `एक महत्वपूर्ण सूचना. ${p.name}, उम्र ${p.age}, ${p.clothing}. वे आख़िरी बार ${where} के पास देखे गए थे, आपसे लगभग ${formatDistance(distanceKm)} दूर. दिखें तो वारीमित्र को बताइए.`;
  }
  return `एक महत्त्वाची सूचना. ${p.name}, वय ${p.age}, ${p.clothing}. ते शेवटचे ${where} जवळ दिसले होते, तुमच्यापासून अंदाजे ${formatDistance(distanceKm)} अंतरावर. तुम्हाला ही व्यक्ती दिसल्यास कृपया वारीमित्रला कळवा.`;
}

export interface CallEngine {
  state: CallState;
  seconds: number;
  messages: Message[];
  partial: string;
  callerLocation: ResolvedLocation | null;
  nearby: NearbyFacility[];
  category: PlaceCategory | null;
  alerts: { name: string; distanceKm: number }[];
  revealedContact: string | null;
  emergency: boolean;
  error: string | null;
  lang: SpeechLang;
  setLang: (l: SpeechLang) => void;
  startCall: () => void;
  endCall: () => void;
  sendText: (text: string) => void;
  muted: boolean;
  toggleMute: () => void;
}

export function useCallEngine(): CallEngine {
  const [lang, setLangState] = useState<SpeechLang>("mr-IN");
  const [state, setState] = useState<CallState>("IDLE");
  const [messages, setMessages] = useState<Message[]>([]);
  const [partial, setPartial] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [callerLocation, setCallerLocation] = useState<ResolvedLocation | null>(null);
  const [nearby, setNearby] = useState<NearbyFacility[]>([]);
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [alerts, setAlerts] = useState<{ name: string; distanceKm: number }[]>([]);
  const [revealedContact, setRevealedContact] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const { speak, stop: stopSpeaking } = useSpeaker();
  const { listen, stop: stopListening } = useListener();

  const langRef = useRef(lang);
  const liveRef = useRef(false);
  const mutedRef = useRef(false);
  const historyRef = useRef<ChatTurn[]>([]);
  const locRef = useRef<ResolvedLocation | null>(null);
  const pendingCategoryRef = useRef<PlaceCategory | null>(null);
  const flowRef = useRef<Flow>({ kind: "none" });
  const locationAttemptsRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const busyRef = useRef(false);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (state === "IDLE" || state === "ENDED") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  const push = useCallback((role: Message["role"], text: string) => {
    setMessages((m) => [...m, { id: uid(), role, text }]);
  }, []);

  const say = useCallback(
    async (text: string) => {
      if (!liveRef.current || !text.trim()) return;
      push("assistant", text);
      historyRef.current.push({ role: "assistant", text });
      setState("SPEAKING");
      await speak(text, langRef.current);
      await new Promise((r) => setTimeout(r, 400));
    },
    [push, speak],
  );

  const endCall = useCallback(() => {
    liveRef.current = false;
    stopSpeaking();
    stopListening();
    setPartial("");
    setState((s) => (s === "IDLE" ? "IDLE" : "ENDED"));
  }, [stopListening, stopSpeaking]);

  /** Real Places search around the caller's real coordinates. */
  const answerFacility = useCallback(
    async (cat: PlaceCategory) => {
      const loc = locRef.current;
      if (!loc) return;
      setCategory(cat);
      let results: NearbyFacility[] = [];
      try {
        const nearest = await findNearestFacility(loc.latitude, loc.longitude, cat);
        results = nearest
          ? await searchFacilitiesByCategory(loc.latitude, loc.longitude, cat, 5)
          : [];
        if (nearest && !results.length) results = [nearest];
      } catch (err) {
        console.error("Places search failed", err);
        setNearby([]);
        await say(T.searchFailed[langRef.current]);
        return;
      }
      setNearby(results);
      const top = results[0] ?? null;

      const spoken = await composePlacesReply(
        historyRef.current,
        langRef.current,
        shortLocationLabel(loc),
        top
          ? {
              name: top.name,
              categoryLabel: top.categoryLabel,
              address: top.address,
              distanceM: top.distanceM,
              openNow: top.openNow,
            }
          : null,
        loc.relative
          ? `The caller's position is an estimate from walking time, about ${loc.relative.approxKm} km ${loc.relative.direction} ${loc.relative.village}.`
          : undefined,
      ).catch(() => null);

      await say(spoken || T.searchFailed[langRef.current]);
      voiceService.logCall({
        intent: CATEGORY_DEFS[cat].english,
        language: LANG_NAME[langRef.current],
        location: shortLocationLabel(loc),
      });
    },
    [say],
  );

  /** Announce only missing-person alerts within the geo-fenced radius. */
  const announceAlerts = useCallback(async () => {
    const loc = locRef.current;
    if (!loc) return;
    const eligible = missingPersonService.eligibleAlerts(loc.latitude, loc.longitude, 3);
    setAlerts(eligible.map((e) => ({ name: e.person.name, distanceKm: e.distanceKm })));
    if (!eligible.length) return;
    for (const { person, distanceKm } of eligible) {
      push(
        "system",
        `GEO-FENCED ALERT — ${person.name} · ${formatDistance(distanceKm)} from the caller (within ${person.alertRadiusKm ?? 100} km radius)`,
      );
      await say(
        alertSentence(
          langRef.current,
          {
            name: person.name,
            age: person.age,
            clothing: person.clothing,
            ...(person.lastKnownLocationText
              ? { lastKnownLocationText: person.lastKnownLocationText }
              : {}),
          },
          distanceKm,
        ),
      );
    }
  }, [push, say]);

  /** Try to turn spoken words into coordinates. Returns true when resolved. */
  const tryResolveLocation = useCallback(
    async (spoken: string): Promise<boolean> => {
      const loc = await resolveSpokenLocation(spoken).catch(() => null);
      if (!loc) return false;
      locRef.current = loc;
      setCallerLocation(loc);
      locationAttemptsRef.current = 0;
      push(
        "system",
        `CALLER LOCATION — ${shortLocationLabel(loc)} · ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)} · confidence ${loc.confidence}`,
      );
      return true;
    },
    [push],
  );

  const handleMissingFlow = useCallback(
    async (text: string) => {
      const flow = flowRef.current;
      if (flow.kind !== "missing") return;
      const L = langRef.current;
      const data = flow.data;

      if (flow.step === "name") {
        data["name"] = text.trim();
        flowRef.current = { ...flow, step: "age" };
        await say(T.missing.age[L]);
        return;
      }
      if (flow.step === "age") {
        data["age"] = String(parseAge(text) || 0);
        flowRef.current = { ...flow, step: "appearance" };
        await say(T.missing.appearance[L]);
        return;
      }
      if (flow.step === "appearance") {
        data["appearance"] = text.trim();
        flowRef.current = { ...flow, step: "lastSeen" };
        await say(T.missing.lastSeen[L]);
        return;
      }
      if (flow.step === "lastSeen") {
        const loc = await resolveSpokenLocation(text).catch(() => null);
        if (!loc) {
          await say(T.askLocationAgain[L]);
          return;
        }
        data["lastSeenText"] = text.trim();
        flowRef.current = { kind: "missing", step: "phone", data, loc };
        await say(T.missing.phone[L]);
        return;
      }

      // phone
      const phone = parsePhone(text);
      if (!phone) {
        await say(T.missing.phoneRetry[L]);
        return;
      }
      const loc = flow.loc!;
      const person = missingPersonService.report({
        name: data["name"] ?? "Unknown",
        age: Number(data["age"]) || 0,
        gender: "Not stated",
        clothing: data["appearance"] ?? "Not stated",
        appearance: data["appearance"] ?? "Not stated",
        height: "Not stated",
        lastSeen: shortLocationLabel(loc),
        lastKnownLocationText: shortLocationLabel(loc),
        lastKnownLatitude: loc.latitude,
        lastKnownLongitude: loc.longitude,
        locationConfidence: loc.confidence,
        reporterPhoneNumber: phone,
        dindi: "Not stated",
        contact: `Reported by voice call · ${maskPhone(phone)}`,
        description: `Reported through a WariMitra voice call in ${LANG_NAME[L]}.`,
      });
      flowRef.current = { kind: "none" };
      push(
        "system",
        `MISSING WARKARI ALERT CREATED — ${person.name}, age ${person.age} · last known ${person.lastKnownLocationText} · reporter ${maskPhone(phone)} · radius ${person.alertRadiusKm} km`,
      );
      voiceService.logCall({
        intent: "Missing",
        language: LANG_NAME[L],
        location: person.lastKnownLocationText ?? "Unknown",
      });
      await say(T.missing.done[L]);
      await say(T.howHelp[L]);
    },
    [push, say],
  );

  const handleSightingFlow = useCallback(
    async (text: string) => {
      const flow = flowRef.current;
      if (flow.kind !== "sighting") return;
      const L = langRef.current;
      const person = missingPersonService.get(flow.personId);
      if (!person) {
        flowRef.current = { kind: "none" };
        await say(T.sighting.none[L]);
        return;
      }
      const loc = (await resolveSpokenLocation(text).catch(() => null)) ?? locRef.current;
      if (!loc) {
        await say(T.askLocationAgain[L]);
        return;
      }
      missingPersonService.addSighting(person.id, {
        location: shortLocationLabel(loc),
        latitude: loc.latitude,
        longitude: loc.longitude,
        locationConfidence: loc.confidence,
        timeSeen: "Just now",
        info: `Reported through a WariMitra voice call (prototype). Caller said: “${text.trim()}”`,
      });
      flowRef.current = { kind: "none" };
      push(
        "system",
        `SIGHTING RECORDED — ${person.name} near ${shortLocationLabel(loc)} · last known location updated`,
      );
      voiceService.logCall({
        intent: "Sighting",
        language: LANG_NAME[L],
        location: shortLocationLabel(loc),
      });

      const phone = person.reporterPhoneNumber;
      setRevealedContact(phone ?? null);
      if (phone) {
        push("system", `REPORTER CONTACT RELEASED to this caller — ${maskPhone(phone)}`);
        const spoken = phone.split("").join(" ");
        await say(
          L === "en-IN"
            ? `Thank you, the sighting is recorded. The contact number saved for this person is ${spoken}.`
            : L === "hi-IN"
              ? `धन्यवाद, जानकारी दर्ज हो गई. इस व्यक्ति के लिए दर्ज संपर्क क्रमांक है ${spoken}.`
              : `धन्यवाद, ही माहिती नोंदवली आहे. या व्यक्तीसाठी नोंदवलेला संपर्क क्रमांक आहे ${spoken}.`,
        );
      } else {
        await say(
          L === "en-IN"
            ? "Thank you, the sighting is recorded and volunteers have been notified."
            : "धन्यवाद, ही माहिती नोंदवली आहे. स्वयंसेवकांना कळवले जात आहे.",
        );
      }
    },
    [push, say],
  );

  const handleUtterance = useCallback(
    async (text: string) => {
      const L = langRef.current;
      historyRef.current.push({ role: "user", text });
      setState("PROCESSING");

      if (flowRef.current.kind === "missing") return handleMissingFlow(text);
      if (flowRef.current.kind === "sighting") return handleSightingFlow(text);

      let nlu;
      try {
        nlu = await understand(historyRef.current, L, {
          callerLocationText: locRef.current ? shortLocationLabel(locRef.current) : undefined,
          callerLocationConfidence: locRef.current?.confidence,
          facilityType: pendingCategoryRef.current ?? undefined,
          activeFlow: flowRef.current.kind,
        });
      } catch (err) {
        console.error("Gemini failure", err);
        setError("AI service error — the call continues with a spoken apology.");
        await say(AI_ERROR_TEXT[L]);
        return;
      }

      // ---- Caller says they have moved on ----
      if (nlu.intent === "location_changed") {
        locRef.current = null;
        setCallerLocation(null);
        flowRef.current = { kind: "await_location" };
        await say(nlu.response || T.askLocationAgain[L]);
        return;
      }

      if (nlu.intent === "goodbye") {
        await say(nlu.response || T.bye[L]);
        endCall();
        return;
      }

      // ---- Missing person report ----
      if (nlu.intent === "missing_person") {
        flowRef.current = { kind: "missing", step: "name", data: {} };
        await say(T.missing.name[L]);
        return;
      }

      // ---- Sighting of an already-alerted person ----
      if (nlu.intent === "missing_person_sighting") {
        const loc = locRef.current;
        const eligible = loc
          ? missingPersonService.eligibleAlerts(loc.latitude, loc.longitude, 1)
          : [];
        const person = eligible[0]?.person;
        if (!person) {
          await say(T.sighting.none[L]);
          return;
        }
        flowRef.current = { kind: "sighting", personId: person.id };
        await say(T.sighting.ask[L]);
        return;
      }

      // ---- Location handling ----
      const firstFix = !locRef.current;
      const spokenLocation = nlu.locationMentioned
        ? `${nlu.locationMentioned} ${/\d|मिनिट|तास/.test(text) ? text : ""}`
        : text;

      if (firstFix || nlu.intent === "provide_location") {
        if (nlu.locationMentioned || flowRef.current.kind === "await_location") {
          const ok = await tryResolveLocation(spokenLocation);
          if (!ok && firstFix) {
            locationAttemptsRef.current += 1;
            await say(
              locationAttemptsRef.current >= 2 ? T.askDirection[L] : T.askLocationAgain[L],
            );
            return;
          }
          if (ok) flowRef.current = { kind: "none" };
        }
      } else if (nlu.locationMentioned) {
        // Location refinement mid-call.
        await tryResolveLocation(spokenLocation);
      }

      const cat =
        normalizeCategory(nlu.facilityType) ??
        normalizeCategory(text) ??
        (nlu.intent === "emergency" ? "medical" : null);
      if (cat) pendingCategoryRef.current = cat;

      if (!locRef.current) {
        await say(nlu.response || T.askLocationAgain[L]);
        return;
      }

      // Fresh location fix → geo-fenced alerts, then continue.
      if (firstFix) {
        await announceAlerts();
        if (!pendingCategoryRef.current) {
          await say(T.howHelp[L]);
          return;
        }
      }

      if (nlu.intent === "emergency") {
        setEmergency(true);
        await say(T.emergency[L]);
        await answerFacility(pendingCategoryRef.current ?? "medical");
        pendingCategoryRef.current = null;
        return;
      }

      if (nlu.intent === "find_facility" || pendingCategoryRef.current) {
        if (!pendingCategoryRef.current) {
          await say(nlu.response || T.askCategory[L]);
          return;
        }
        await answerFacility(pendingCategoryRef.current);
        pendingCategoryRef.current = null;
        return;
      }

      await say(nlu.response || T.askAgain[L]);
    },
    [
      announceAlerts,
      answerFacility,
      endCall,
      handleMissingFlow,
      handleSightingFlow,
      say,
      tryResolveLocation,
    ],
  );

  /** LISTEN → TRANSCRIBE → PROCESS → SPEAK → LISTEN … */
  const loop = useCallback(async () => {
    let misses = 0;
    while (liveRef.current) {
      if (busyRef.current || mutedRef.current) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      setPartial("");
      setState("LISTENING");
      const res = await listen(langRef.current, (t) => {
        setPartial(t);
        setState(t ? "TRANSCRIBING" : "LISTENING");
      });
      if (!liveRef.current) break;
      setPartial("");

      if (res.error === "not-allowed") {
        setError("Microphone permission denied. Allow the microphone and start the call again.");
        endCall();
        break;
      }
      if (res.error === "unsupported") {
        setError(
          "Speech recognition is not supported in this browser. Please use Chrome or Edge on desktop or Android to speak with WariMitra.",
        );
        setState("CONNECTED");
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      const text = res.transcript.trim();
      if (!text) {
        misses += 1;
        if (misses >= 3) {
          await say(T.askAgain[langRef.current]);
          misses = 0;
        }
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      misses = 0;
      push("user", text);
      await handleUtterance(text);
    }
  }, [endCall, handleUtterance, listen, push, say]);

  const openingLines = useCallback(async () => {
    const L = langRef.current;
    const announcement = announcementService.latest();
    if (announcement) {
      push("system", `Live announcement — ${announcement.type}`);
    }
    await say(T.greeting[L]);
    flowRef.current = { kind: "await_location" };
  }, [push, say]);

  const startCall = useCallback(() => {
    if (liveRef.current) return;
    setError(null);
    setMessages([]);
    setNearby([]);
    setAlerts([]);
    setCategory(null);
    setRevealedContact(null);
    setCallerLocation(null);
    setEmergency(false);
    setSeconds(0);
    setMuted(false);
    historyRef.current = [];
    locRef.current = null;
    pendingCategoryRef.current = null;
    locationAttemptsRef.current = 0;
    flowRef.current = { kind: "await_location" };
    setState("CALLING");

    queueRef.current = queueRef.current.then(async () => {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
        stream?.getTracks().forEach((t) => t.stop());
      } catch {
        setError("Microphone permission denied. WariMitra needs the microphone for a voice call.");
        setState("ENDED");
        return;
      }
      await new Promise((r) => setTimeout(r, 900));
      liveRef.current = true;
      setState("CONNECTED");
      await openingLines();
    });
    void queueRef.current.then(() => loop());
  }, [loop, openingLines]);

  /** Typed fallback (accessibility / unsupported browsers) feeds the same pipeline. */
  const sendText = useCallback(
    (text: string) => {
      if (!liveRef.current || !text.trim()) return;
      busyRef.current = true;
      stopListening();
      push("user", text);
      queueRef.current = queueRef.current
        .then(() => handleUtterance(text))
        .finally(() => {
          busyRef.current = false;
        });
    },
    [handleUtterance, push, stopListening],
  );

  const setLang = useCallback((l: SpeechLang) => setLangState(l), []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) stopListening();
      return !m;
    });
  }, [stopListening]);

  useEffect(
    () => () => {
      liveRef.current = false;
      stopSpeaking();
      stopListening();
    },
    [stopListening, stopSpeaking],
  );

  return {
    state,
    seconds,
    messages,
    partial,
    callerLocation,
    nearby,
    category,
    alerts,
    revealedContact,
    emergency,
    error,
    lang,
    setLang,
    startCall,
    endCall,
    sendText,
    muted,
    toggleMute,
  };
}
