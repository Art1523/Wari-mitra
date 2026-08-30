import { facilityService } from "./facilityService";
import { missingPersonService } from "./missingPersonService";
import { SEED_CALLS, type CallRecord, type Facility, type FacilityCategory } from "@/data/mockData";
import { readKey, subscribe, uid, writeKey } from "./storage";

const KEY = "calls";

export type Lang = "mr" | "hi" | "en";

export interface Turn {
  id: string;
  role: "user" | "ai" | "system";
  text: string;
}

export type ScenarioId = "medical" | "toilet" | "water" | "emergency" | "missing";

interface ScenarioScript {
  id: ScenarioId;
  label: Record<Lang, string>;
  category?: FacilityCategory;
  emergency?: boolean;
  turns: Record<Lang, { role: "user" | "ai"; text: string }[]>;
}

/**
 * Scripted demo conversations. In production this array is replaced by an
 * ASR + NLU + TTS pipeline behind the same `voiceService.runScenario` shape.
 */
export const SCENARIOS: ScenarioScript[] = [
  {
    id: "medical",
    category: "Medical",
    label: { mr: "वैद्यकीय मदत शोधा", hi: "मेडिकल कैंप खोजें", en: "Find Medical Camp" },
    turns: {
      mr: [
        { role: "user", text: "माझ्या जवळ मेडिकल कुठे आहे?" },
        { role: "ai", text: "तुम्ही सध्या कोणत्या गावाजवळ किंवा ठिकाणाजवळ आहात?" },
        { role: "user", text: "मी जेजुरीजवळ आहे." },
        { role: "ai", text: "तुमच्या जवळ अंदाजे 450 मीटरवर वैद्यकीय मदत केंद्र आहे." },
      ],
      hi: [
        { role: "user", text: "मेरे पास मेडिकल कैंप कहाँ है?" },
        { role: "ai", text: "आप इस समय किस गाँव या स्थान के पास हैं?" },
        { role: "user", text: "मैं जेजुरी के पास हूँ." },
        { role: "ai", text: "आपके पास लगभग 450 मीटर पर चिकित्सा सहायता केंद्र है." },
      ],
      en: [
        { role: "user", text: "Where is the nearest medical camp?" },
        { role: "ai", text: "Which village or landmark are you near right now?" },
        { role: "user", text: "I am near Jejuri." },
        { role: "ai", text: "There is a medical help centre about 450 metres from you." },
      ],
    },
  },
  {
    id: "toilet",
    category: "Toilet",
    label: { mr: "शौचालय शोधा", hi: "शौचालय खोजें", en: "Find Toilet" },
    turns: {
      mr: [
        { role: "user", text: "जवळ शौचालय कुठे आहे?" },
        { role: "ai", text: "कृपया जवळचे गाव किंवा खूण सांगा." },
        { role: "user", text: "जेजुरी चेकपॉईंटजवळ." },
        { role: "ai", text: "अंदाजे 220 मीटरवर फिरते शौचालय ब्लॉक उपलब्ध आहे." },
      ],
      hi: [
        { role: "user", text: "पास में शौचालय कहाँ है?" },
        { role: "ai", text: "कृपया नज़दीकी गाँव या निशानी बताइए." },
        { role: "user", text: "जेजुरी चेकपॉइंट के पास." },
        { role: "ai", text: "लगभग 220 मीटर पर मोबाइल शौचालय ब्लॉक उपलब्ध है." },
      ],
      en: [
        { role: "user", text: "Where is a toilet near me?" },
        { role: "ai", text: "Please tell me the nearest village or landmark." },
        { role: "user", text: "Near the Jejuri checkpoint." },
        { role: "ai", text: "A mobile toilet block is available about 220 metres away." },
      ],
    },
  },
  {
    id: "water",
    category: "Water",
    label: { mr: "पिण्याचे पाणी", hi: "पीने का पानी", en: "Find Water" },
    turns: {
      mr: [
        { role: "user", text: "पिण्याचे पाणी कुठे मिळेल?" },
        { role: "ai", text: "तुम्ही कोणत्या ठिकाणाजवळ आहात?" },
        { role: "user", text: "जेजुरी." },
        { role: "ai", text: "अंदाजे 180 मीटरवर पिण्याच्या पाण्याचा टँकर पॉईंट सुरू आहे." },
      ],
      hi: [
        { role: "user", text: "पीने का पानी कहाँ मिलेगा?" },
        { role: "ai", text: "आप किस स्थान के पास हैं?" },
        { role: "user", text: "जेजुरी." },
        { role: "ai", text: "लगभग 180 मीटर पर पीने के पानी का टैंकर पॉइंट चालू है." },
      ],
      en: [
        { role: "user", text: "Where can I get drinking water?" },
        { role: "ai", text: "Which location are you near?" },
        { role: "user", text: "Jejuri." },
        { role: "ai", text: "A drinking water tanker point is open about 180 metres away." },
      ],
    },
  },
  {
    id: "emergency",
    category: "Medical",
    emergency: true,
    label: { mr: "आपत्कालीन मदत", hi: "आपातकालीन सहायता", en: "Emergency" },
    turns: {
      mr: [
        { role: "user", text: "एका व्यक्तीला चक्कर आली आहे." },
        { role: "ai", text: "ही आपत्कालीन परिस्थिती आहे. तुम्ही कोणत्या ठिकाणाजवळ आहात?" },
        { role: "user", text: "जेजुरीजवळ, दिंडी 128." },
        {
          role: "ai",
          text: "जवळचे वैद्यकीय केंद्र 450 मीटरवर आणि स्वयंसेवक 300 मीटरवर आहे. मदत पथकाला माहिती दिली जात आहे.",
        },
      ],
      hi: [
        { role: "user", text: "एक व्यक्ति को चक्कर आ गया है." },
        { role: "ai", text: "यह आपातकालीन स्थिति है. आप किस स्थान के पास हैं?" },
        { role: "user", text: "जेजुरी के पास, दिंडी 128." },
        {
          role: "ai",
          text: "नज़दीकी चिकित्सा केंद्र 450 मीटर और स्वयंसेवक 300 मीटर पर है. सहायता दल को सूचित किया जा रहा है.",
        },
      ],
      en: [
        { role: "user", text: "A person has fainted here." },
        { role: "ai", text: "This is an emergency. Which location are you near?" },
        { role: "user", text: "Near Jejuri, Dindi 128." },
        {
          role: "ai",
          text: "Nearest medical camp is 450 m and a volunteer is 300 m away. The help team is being notified.",
        },
      ],
    },
  },
  {
    id: "missing",
    label: { mr: "हरवलेला वारकरी", hi: "लापता वारकरी", en: "Missing Warkari" },
    turns: {
      mr: [
        { role: "user", text: "आमच्या दिंडीतील एक वारकरी हरवला आहे." },
        { role: "ai", text: "कृपया त्यांचे नाव, वय आणि शेवटचे ठिकाण सांगा." },
        { role: "user", text: "विठ्ठल जाधव, वय ६७, जेजुरीजवळ हरवले." },
        { role: "ai", text: "माहिती नोंदवली आहे. समुदाय सूचना सक्रिय केली जात आहे." },
      ],
      hi: [
        { role: "user", text: "हमारी दिंडी का एक वारकरी लापता है." },
        { role: "ai", text: "कृपया उनका नाम, उम्र और अंतिम स्थान बताइए." },
        { role: "user", text: "विठ्ठल जाधव, उम्र 67, जेजुरी के पास लापता." },
        { role: "ai", text: "जानकारी दर्ज कर ली गई है. सामुदायिक सूचना सक्रिय की जा रही है." },
      ],
      en: [
        { role: "user", text: "A Warkari from our Dindi is missing." },
        { role: "ai", text: "Please tell me their name, age and last seen location." },
        { role: "user", text: "Vitthal Jadhav, age 67, last seen near Jejuri." },
        { role: "ai", text: "Details recorded. A community alert is being activated." },
      ],
    },
  },
];

export const GREETING: Record<Lang, string> = {
  mr: "नमस्कार, मी वारीमित्र. आता मी तुम्हाला कशी मदत करू?",
  hi: "नमस्ते, मैं वारीमित्र हूँ. मैं आपकी कैसे मदद करूँ?",
  en: "Namaskar, this is WariMitra. How can I help you?",
};

export const CONTINUE_PROMPT: Record<Lang, string> = {
  mr: "आता मी तुम्हाला कशी मदत करू?",
  hi: "अब मैं आपकी कैसे मदद करूँ?",
  en: "Now, how can I help you?",
};

export function broadcastLine(lang: Lang, name: string, age: number, place: string) {
  if (lang === "mr")
    return `महत्त्वाची सूचना: ${name === "Vitthal Jadhav" ? "विठ्ठल जाधव" : name}, वय ${age}, पांढरा कुर्ता आणि गांधी टोपी परिधान केलेले आहेत. ते ${place === "Jejuri" ? "जेजुरी" : place}जवळून हरवले आहेत. दिसल्यास कृपया WariMitra वर कळवा.`;
  if (lang === "hi")
    return `महत्वपूर्ण सूचना: ${name}, उम्र ${age}, सफेद कुर्ता और गांधी टोपी पहने हुए हैं. वे ${place} के पास से लापता हैं. दिखने पर कृपया WariMitra को सूचित करें.`;
  return `Important community alert: ${name}, age ${age}, wearing a white kurta and Gandhi cap, is missing near ${place}. If you see them, please inform WariMitra.`;
}

export const voiceService = {
  key: KEY,
  subscribe: (fn: () => void) => subscribe(KEY, fn),

  scenarios: SCENARIOS,

  getScenario(id: ScenarioId) {
    return SCENARIOS.find((s) => s.id === id)!;
  },

  /** Resolve the answer card the assistant shows alongside the spoken reply. */
  resolveResult(id: ScenarioId, location: string): Facility | undefined {
    const s = voiceService.getScenario(id);
    if (!s.category) return undefined;
    return facilityService.nearest(location, s.category) ?? facilityService.byLocation(location)[0];
  },

  activeAlert() {
    return missingPersonService.active()[0];
  },

  logCall(rec: Omit<CallRecord, "id" | "createdAt">) {
    const call: CallRecord = { ...rec, id: uid(), createdAt: new Date().toISOString() };
    writeKey(KEY, [call, ...voiceService.calls()]);
    return call;
  },

  calls(): CallRecord[] {
    return readKey<CallRecord[]>(KEY, SEED_CALLS);
  },

  reset() {
    writeKey(KEY, SEED_CALLS);
  },
};
