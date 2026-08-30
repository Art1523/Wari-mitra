/**
 * Medical camp registry (prototype).
 *
 * Standalone from the mock facility data used by the rest of the app — adding
 * camps here does NOT alter the voice-call or facility-finder workflows. Data
 * lives in localStorage via the shared store, so a future REST backend can
 * swap these four functions for `fetch()` calls.
 */
import { readKey, writeKey, uid } from "./storage";

export type CampType = "medical" | "first-aid" | "ambulance" | "doctor-on-call";

export interface MedicalCamp {
  id: string;
  name: string;
  type: CampType;
  village: string;
  landmark: string;
  contact: string;
  timings: string;
  facilities: string;
  active: boolean;
  createdAt: string;
}

export const CAMP_TYPE_LABEL: Record<CampType, string> = {
  medical: "Medical Camp",
  "first-aid": "First Aid Post",
  ambulance: "Ambulance Point",
  "doctor-on-call": "Doctor on Call",
};

export type CampDraft = Omit<MedicalCamp, "id" | "createdAt">;

const KEY = "medical-camps";

export const campService = {
  key: KEY,

  list(): MedicalCamp[] {
    return readKey<MedicalCamp[]>(KEY, []);
  },

  add(draft: CampDraft): MedicalCamp {
    const camp: MedicalCamp = { ...draft, id: uid(), createdAt: new Date().toISOString() };
    writeKey(KEY, [camp, ...campService.list()]);
    return camp;
  },

  update(id: string, patch: Partial<CampDraft>) {
    writeKey(
      KEY,
      campService.list().map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  },

  remove(id: string) {
    writeKey(
      KEY,
      campService.list().filter((c) => c.id !== id),
    );
  },

  toCsv(): string {
    const rows = campService.list();
    const head = [
      "name",
      "type",
      "village",
      "landmark",
      "contact",
      "timings",
      "facilities",
      "active",
      "createdAt",
    ];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    return [
      head.join(","),
      ...rows.map((r) =>
        [
          r.name,
          CAMP_TYPE_LABEL[r.type],
          r.village,
          r.landmark,
          r.contact,
          r.timings,
          r.facilities,
          r.active ? "active" : "closed",
          r.createdAt,
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\n");
  },
};
