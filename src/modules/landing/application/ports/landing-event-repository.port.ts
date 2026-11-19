import type { LandingEventBatch } from "@/modules/landing/domain/landing-event";

export interface LandingEventRepositoryPort {
  /** Stores every event of the batch in one statement. */
  insertBatch(batch: LandingEventBatch): Promise<void>;
}

export const LANDING_EVENT_REPOSITORY = Symbol("LANDING_EVENT_REPOSITORY");
