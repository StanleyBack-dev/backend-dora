// Anonymous analytics of the landing page: a random visitor id (kept by the
// browser) and session id; no IP, no personal data.

export enum LandingEventType {
  PAGE_VIEW = "PAGE_VIEW",
  SECTION_VIEW = "SECTION_VIEW",
  CLICK = "CLICK",
  VIDEO_PLAY = "VIDEO_PLAY",
  VIDEO_COMPLETE = "VIDEO_COMPLETE",
  DEMO_STEP = "DEMO_STEP",
  FORM_START = "FORM_START",
  FORM_SUBMIT = "FORM_SUBMIT",
  FORM_SUCCESS = "FORM_SUCCESS",
  FORM_ERROR = "FORM_ERROR",
  SCROLL_DEPTH = "SCROLL_DEPTH",
}

export enum LandingDevice {
  MOBILE = "MOBILE",
  TABLET = "TABLET",
  DESKTOP = "DESKTOP",
}

/**
 * Click names follow "<target>:<place>" (e.g. "whatsapp:hero"); these
 * targets count as contact clicks.
 */
export const CONTACT_TARGETS = [
  "whatsapp",
  "email",
  "instagram",
  "facebook",
  "linkedin",
  "youtube",
  "tiktok",
] as const;

export const MAX_EVENTS_PER_BATCH = 25;

export const LANDING_EVENT_LIMITS = {
  name: 80,
  path: 200,
} as const;

export type LandingEvent = {
  type: LandingEventType;
  name: string | null;
  path: string;
};

/** One beacon from the page: who (anonymously), from where, and what. */
export type LandingEventBatch = {
  visitorId: string;
  sessionId: string;
  device: LandingDevice;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  events: LandingEvent[];
};

// Crawlers, link previews and headless browsers are not visitors.
const BOT_AGENT =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|vercel/i;

export function isBotAgent(userAgent: string | null): boolean {
  return !userAgent || BOT_AGENT.test(userAgent);
}

const NAME = /^[\w:./-]*$/;

/** Keeps only well-formed events (safe names, absolute paths). */
export function cleanEvents(events: LandingEvent[]): LandingEvent[] {
  return events
    .slice(0, MAX_EVENTS_PER_BATCH)
    .map((event) => ({
      type: event.type,
      name: event.name?.trim().slice(0, LANDING_EVENT_LIMITS.name) || null,
      path: event.path.trim().slice(0, LANDING_EVENT_LIMITS.path),
    }))
    .filter(
      (event) =>
        event.path.startsWith("/") && (!event.name || NAME.test(event.name)),
    );
}
