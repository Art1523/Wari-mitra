import { SEED_ANNOUNCEMENTS, type Announcement, type AnnouncementType } from "@/data/mockData";
import { readKey, subscribe, uid, writeKey } from "./storage";

const KEY = "announcements";

export const ANNOUNCEMENT_TYPES: AnnouncementType[] = [
  "Weather Alert",
  "Route Diversion",
  "Medical Camp Update",
  "Crowd Alert",
  "Food Distribution Update",
];

export const announcementService = {
  key: KEY,
  subscribe: (fn: () => void) => subscribe(KEY, fn),

  list(): Announcement[] {
    return readKey<Announcement[]>(KEY, SEED_ANNOUNCEMENTS);
  },

  latest(): Announcement | undefined {
    return announcementService.list()[0];
  },

  publish(data: Omit<Announcement, "id" | "createdAt">): Announcement {
    const a: Announcement = { ...data, id: uid(), createdAt: new Date().toISOString() };
    writeKey(KEY, [a, ...announcementService.list()]);
    return a;
  },

  remove(id: string) {
    writeKey(
      KEY,
      announcementService.list().filter((a) => a.id !== id),
    );
  },

  reset() {
    writeKey(KEY, SEED_ANNOUNCEMENTS);
  },
};
