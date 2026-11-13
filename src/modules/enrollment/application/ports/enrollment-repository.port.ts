import type {
  EnrollmentData,
  EnrollmentInvite,
  EnrollmentRequest,
  EnrollmentStatus,
} from "@/modules/enrollment/domain/enrollment";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

/** A request with its unit's label ("Bloco A · 101"), for the review. */
export type EnrollmentRequestView = EnrollmentRequest & {
  unitBlock: string | null;
  unitNumber: string | null;
};
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type EnrollmentRequestFilter = {
  condominiumId: string;
  status?: EnrollmentStatus;
  /** Name or e-mail. */
  search?: string;
};

export interface EnrollmentRepositoryPort {
  // === invites ===
  /** The condominium's, most recent first. */
  listInvites(
    condominiumId: string,
    limit: number,
  ): Promise<EnrollmentInvite[]>;
  findInvite(id: string): Promise<EnrollmentInvite | null>;
  /** The open invite (not revoked, not expired) holding this code. */
  findOpenInviteByCode(
    code: string,
    now: Date,
  ): Promise<EnrollmentInvite | null>;
  createInvite(data: {
    condominiumId: string;
    code: string;
    label: string;
    expiresAt: Date;
    createdBy: string;
  }): Promise<EnrollmentInvite>;
  revokeInvite(id: string, at: Date): Promise<EnrollmentInvite>;

  // === requests ===
  pageRequests(
    filter: EnrollmentRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<EnrollmentRequestView>>;
  findRequest(id: string): Promise<EnrollmentRequestView | null>;
  /** A pending request with this e-mail there (to avoid duplicates). */
  findPending(input: {
    email: string;
    condominiumId: string;
  }): Promise<EnrollmentRequest | null>;
  countPending(condominiumId: string): Promise<number>;
  /** Stores the request and its notices (outbox) in one transaction. */
  createRequest(
    data: EnrollmentData & {
      condominiumId: string;
      inviteId: string;
      consentAt: Date;
      photoKey: string | null;
    },
    notices: (requestId: string) => OutboxDraft[],
  ): Promise<EnrollmentRequest>;
  /** Corrected data and/or the review outcome. */
  updateRequest(
    id: string,
    patch: Partial<EnrollmentData> & {
      status?: EnrollmentStatus;
      reviewedBy?: string;
      reviewedAt?: Date;
      rejectionReason?: string | null;
      userId?: string;
      photoKey?: string | null;
    },
  ): Promise<EnrollmentRequestView>;
}

export const ENROLLMENT_REPOSITORY = Symbol("ENROLLMENT_REPOSITORY");
