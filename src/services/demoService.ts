import { announcementService } from "./announcementService";
import { facilityService } from "./facilityService";
import { missingPersonService } from "./missingPersonService";
import { voiceService } from "./voiceService";
import { readKey, writeKey } from "./storage";

const KEY = "demoMode";

export interface DemoStep {
  n: number;
  title: string;
  detail: string;
  to: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    n: 1,
    title: "Warkari asks for a medical camp",
    detail: "Open the Voice Assistant and play the “Find Medical Camp” scenario.",
    to: "/voice",
  },
  {
    n: 2,
    title: "Location identified from “Jejuri”",
    detail: "The landmark spoken by the caller sets the location context.",
    to: "/voice",
  },
  {
    n: 3,
    title: "Nearest medical camp displayed",
    detail: "The Nearest Help card shows the camp at 450 m.",
    to: "/voice",
  },
  {
    n: 4,
    title: "Missing Warkari alert registered",
    detail: "Submit the Report a Missing Warkari form.",
    to: "/missing",
  },
  {
    n: 5,
    title: "Another caller receives the alert",
    detail: "A new call opens with the community voice broadcast.",
    to: "/voice",
  },
  {
    n: 6,
    title: "Caller reports a sighting",
    detail: "Use “I Saw This Person” on the Community Alert screen.",
    to: "/community",
  },
  {
    n: 7,
    title: "Command Centre receives the sighting",
    detail: "The sighting appears under Missing Warkaris.",
    to: "/command",
  },
  {
    n: 8,
    title: "Volunteer updates a facility",
    detail: "Publish an announcement or change a facility status.",
    to: "/command",
  },
  {
    n: 9,
    title: "Voice Assistant receives the update",
    detail: "The live announcement banner appears for callers.",
    to: "/voice",
  },
];

export const demoService = {
  key: KEY,
  isOn(): boolean {
    return readKey<boolean>(KEY, false);
  },
  enable() {
    facilityService.reset();
    missingPersonService.reset();
    announcementService.reset();
    voiceService.reset();
    writeKey(KEY, true);
  },
  disable() {
    writeKey(KEY, false);
  },
  resetAll() {
    facilityService.reset();
    missingPersonService.reset();
    announcementService.reset();
    voiceService.reset();
  },
};
