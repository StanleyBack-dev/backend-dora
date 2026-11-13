import type { UserGroup } from "@/modules/access-control/domain/user-group";

// An announcement (comunicado) from a manager to the members of their
// condominium: everyone, or everyone with one role (residents or managers).

export enum BroadcastAudience {
  TODOS = "TODOS",
  GRUPO = "GRUPO",
}

export type Broadcast = {
  id: string;
  condominiumId: string;
  title: string;
  body: string;
  audience: BroadcastAudience;
  /** Target role (only when the audience is GRUPO): USER or ADMIN. */
  targetGroup: UserGroup | null;
  sendEmail: boolean;
  recipients: number;
  createdBy: string;
  createdAt: Date;
};

export type BroadcastDraft = {
  title: string;
  body: string;
  audience: BroadcastAudience;
  targetGroup?: UserGroup | null;
  sendEmail: boolean;
};

export type BroadcastViolation =
  "title-length" | "body-length" | "group-required";

const collapse = (value: string) => value.trim().replace(/[ \t]+/g, " ");

/** Trimmed, with the target that matches the audience (and only that one). */
export function normalizeBroadcast(
  draft: BroadcastDraft,
): Required<BroadcastDraft> | BroadcastViolation {
  const title = collapse(draft.title);
  const body = draft.body.trim().replace(/\n{3,}/g, "\n\n");
  if (title.length < 3 || title.length > 120) return "title-length";
  if (body.length < 3 || body.length > 2000) return "body-length";
  const targetGroup =
    draft.audience === BroadcastAudience.GRUPO
      ? (draft.targetGroup ?? null)
      : null;
  if (draft.audience === BroadcastAudience.GRUPO && !targetGroup) {
    return "group-required";
  }
  return {
    title,
    body,
    audience: draft.audience,
    targetGroup,
    sendEmail: draft.sendEmail,
  };
}
