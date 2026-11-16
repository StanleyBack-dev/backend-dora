import type { EntryDenial } from "@/modules/events/domain/event-ticket-entry";

/** Whether the gate can let a ticket in now (the API's view of it). */
export enum TicketEntryWindow {
  OPEN = "OPEN",
  /** More than 3 hours before the event starts. */
  TOO_EARLY = "TOO_EARLY",
  FINISHED = "FINISHED",
  /** The event was cancelled (or the order isn't confirmed). */
  CANCELLED = "CANCELLED",
}

export const entryWindowOf = (
  denial: EntryDenial | null,
): TicketEntryWindow => {
  if (denial === "too-early") return TicketEntryWindow.TOO_EARLY;
  if (denial === "finished") return TicketEntryWindow.FINISHED;
  if (denial === "not-valid") return TicketEntryWindow.CANCELLED;
  return TicketEntryWindow.OPEN;
};
