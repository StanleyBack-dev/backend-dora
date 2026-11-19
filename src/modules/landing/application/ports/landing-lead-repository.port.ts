import type {
  Lead,
  LeadAttribution,
  LeadDraft,
  LeadMailStatus,
} from "@/modules/landing/domain/landing-lead";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export interface LandingLeadRepositoryPort {
  create(lead: LeadDraft & LeadAttribution): Promise<Lead>;
  setMailStatus(id: string, status: LeadMailStatus): Promise<void>;
  /** Whether this e-mail sent this exact message since `since`. */
  hasDuplicateSince(
    email: string,
    message: string,
    since: Date,
  ): Promise<boolean>;
  /** Leads since `since`, most recent first. */
  list(since: Date, page: PageRequest): Promise<Paginated<Lead>>;
}

export const LANDING_LEAD_REPOSITORY = Symbol("LANDING_LEAD_REPOSITORY");
