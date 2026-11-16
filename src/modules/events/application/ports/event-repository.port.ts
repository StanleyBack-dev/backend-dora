import type {
  CondominiumEvent,
  EventData,
} from "@/modules/events/domain/event";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

/** An event with its space's name (read from the spaces table). */
export type EventView = CondominiumEvent & { spaceName: string | null };

export type EventListFilter = {
  /** Upcoming (not over yet) or past. */
  when: "upcoming" | "past";
  /** Managers also see drafts. */
  includeDrafts: boolean;
};

export interface EventRepositoryPort {
  /** Upcoming by start; past from the most recent (at most 100). */
  list(
    condominiumId: string,
    filter: EventListFilter,
    now: Date,
  ): Promise<EventView[]>;
  /** Only an event of this condominium. */
  find(condominiumId: string, id: string): Promise<EventView | null>;
  create(
    condominiumId: string,
    data: EventData,
    createdBy: string,
  ): Promise<EventView>;
  update(id: string, data: EventData): Promise<EventView>;
  /** Publishes it and stores the residents' notices in the same transaction. */
  publish(id: string, at: Date, notices: OutboxDraft[]): Promise<EventView>;
  /** Cancels it with the reason; notices (if any) in the same transaction. */
  cancel(
    id: string,
    reason: string,
    at: Date,
    notices: OutboxDraft[],
  ): Promise<EventView>;
}

export const EVENT_REPOSITORY = Symbol("EVENT_REPOSITORY");
