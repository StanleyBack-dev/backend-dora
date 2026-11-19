import type { Broadcast } from "@/modules/broadcasts/domain/broadcast";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

export type BroadcastView = Broadcast & { authorName: string | null };

/** Days the "recent" numbers of the stats cover. */
export const BROADCAST_RECENT_DAYS = 30;

/** The condominium's broadcasts at a glance. */
export type BroadcastStats = {
  total: number;
  /** Sent in the last BROADCAST_RECENT_DAYS days. */
  recent: number;
  /** Sent by e-mail too (all time). */
  withEmail: number;
  /** People reached in the last BROADCAST_RECENT_DAYS days. */
  recentRecipients: number;
};

export interface BroadcastRepositoryPort {
  /** Stores the announcement and its deliveries in one transaction. */
  create(
    broadcast: Omit<Broadcast, "id" | "createdAt">,
    deliveries: (broadcastId: string) => OutboxDraft[],
  ): Promise<BroadcastView>;
  /** The condominium's, most recent first. */
  list(condominiumId: string, limit: number): Promise<BroadcastView[]>;
  stats(condominiumId: string): Promise<BroadcastStats>;
}

export const BROADCAST_REPOSITORY = Symbol("BROADCAST_REPOSITORY");
