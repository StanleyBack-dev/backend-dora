import type { FoundItemCategory } from "@/modules/lost-and-found/domain/found-item";
import type { LostReportStatus } from "@/modules/lost-and-found/domain/lost-report";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** "Perdi algo": what a resident lost. */
export type LostReport = {
  id: string;
  condominiumId: string;
  userId: string;
  userName: string;
  /** Their unit there (null: none). */
  unitId: string | null;
  unitLabel: string | null;
  category: FoundItemCategory;
  title: string;
  description: string | null;
  lostLocation: string | null;
  /** The local day it was lost ("2026-11-20"; null: not informed). */
  lostOn: string | null;
  /** A photo of the object, or of one like it (null: none). */
  photoKey: string | null;
  /** Shown to the neighbours on the board (without who nor the details). */
  shared: boolean;
  /** Neighbours who said "Achei isso". */
  spotCount: number;
  status: LostReportStatus;
  /** The found item it ended with (null: none). */
  foundItemId: string | null;
  closedAt: Date | null;
  createdAt: Date;
};

export type NewLostReport = {
  condominiumId: string;
  userId: string;
  category: FoundItemCategory;
  title: string;
  description: string | null;
  lostLocation: string | null;
  lostOn: string | null;
  photoKey: string | null;
  shared: boolean;
};

export interface LostReportRepositoryPort {
  create(report: NewLostReport): Promise<LostReport>;
  find(condominiumId: string, id: string): Promise<LostReport | null>;
  /** A resident's reports, open first, newest first. */
  mine(
    condominiumId: string,
    userId: string,
    page: PageRequest,
  ): Promise<Paginated<LostReport>>;
  /** The condominium's reports (open, or closed), newest first. */
  list(
    condominiumId: string,
    open: boolean,
    page: PageRequest,
  ): Promise<Paginated<LostReport>>;
  /**
   * The neighbours' board: open reports shared, newest first, each saying
   * whether the viewer already said "Achei isso".
   */
  board(
    condominiumId: string,
    viewerId: string,
    page: PageRequest,
  ): Promise<Paginated<LostReport & { spottedByMe: boolean }>>;
  /**
   * "Achei isso", once per person and report, with the notices in the same
   * transaction (false: they had said it already; nothing is written).
   */
  spot(
    reportId: string,
    userId: string,
    note: string | null,
    notices: OutboxDraft[],
  ): Promise<boolean>;
  /** Writes notices (e.g. a report expired); repeated keys are ignored. */
  notify(notices: OutboxDraft[]): Promise<void>;
  /** Open reports of a category: who to tell of a new item. */
  openOf(
    condominiumId: string,
    category: FoundItemCategory,
  ): Promise<LostReport[]>;
  /**
   * Ends an open report of the resident (null: not open or not theirs).
   */
  close(
    id: string,
    userId: string,
    status: LostReportStatus.FOUND | LostReportStatus.CANCELLED,
    at: Date,
  ): Promise<LostReport | null>;
  /**
   * The item went back to a resident: their open reports of its category
   * end as found, linked to it. Returns how many.
   */
  closeFoundBy(
    userId: string,
    itemId: string,
    category: FoundItemCategory,
    at: Date,
  ): Promise<number>;
  /**
   * Drops the photos of reports closed before `closedBefore`; returns their
   * keys, to delete the files.
   */
  releasePhotos(closedBefore: Date): Promise<string[]>;
  /**
   * The item a report was linked to turned out not to be it (reservation
   * lifted): those reports are open again. Returns how many.
   */
  reopenLinkedTo(itemId: string): Promise<number>;
  /** Open reports created before `before` end as expired; returns them. */
  expire(before: Date, at: Date): Promise<LostReport[]>;
  /** Open reports in the condominium (indicators). */
  countOpen(condominiumId: string): Promise<number>;
}

export const LOST_REPORT_REPOSITORY = Symbol("LOST_REPORT_REPOSITORY");
