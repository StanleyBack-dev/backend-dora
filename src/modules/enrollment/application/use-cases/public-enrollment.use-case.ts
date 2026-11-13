import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { CondominiumStatus } from "@/modules/condominiums/domain/condominium";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import {
  ENROLLMENT_REPOSITORY,
  type EnrollmentRepositoryPort,
} from "@/modules/enrollment/application/ports/enrollment-repository.port";
import {
  capitalizeFullName,
  enrollmentPhotoKey,
  type EnrollmentData,
  type EnrollmentInvite,
} from "@/modules/enrollment/domain/enrollment";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import {
  deliveryDraft,
  type NotificationDelivery,
} from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import { decodePhoto } from "@/shared/domain/profile-photo";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";
import { rateStatus, type RateRule } from "@/shared/domain/rate-limit";
import {
  EnrollmentInput,
  validateEnrollment,
} from "@/modules/enrollment/application/enrollment-input";

/** Time to fill in the form after typing the code. */
export const FORM_TTL_MINUTES = 60;
/** Per-IP limits on the public endpoints. */
export const LIMITS: Record<"verify" | "submit", RateRule> = {
  verify: { limit: 10, windowMs: 15 * 60_000 },
  submit: { limit: 5, windowMs: 60 * 60_000 },
};

/** What the public form shows once the code is accepted. */
export type EnrollmentForm = {
  condominiumName: string;
  /** Empty when the condominium has no units registered. */
  units: { id: string; label: string }[];
};

/** Tells a reviewer that a sign-up awaits approval. */
export function submittedNotice(
  userId: string,
  data: Omit<EnrollmentData, "unitId">,
  condominiumName: string,
): NotificationDelivery {
  return {
    userId,
    type: NotificationType.ENROLLMENT_SUBMITTED,
    title: "Novo cadastro aguardando aprovação",
    body: `${data.fullName} enviou o cadastro pelo link público (${condominiumName}).`,
    link: "/admin/cadastros",
    email: {
      subject: `Cadastro aguardando aprovação: ${data.fullName}`,
      intro:
        "Um novo cadastro foi enviado pelo link público e aguarda a sua análise.",
      details: [
        { label: "Condomínio", value: condominiumName },
        { label: "Nome", value: data.fullName },
        { label: "E-mail", value: data.email },
      ],
      ctaLabel: "Analisar cadastro",
    },
    calendar: null,
  };
}

@Injectable()
export class PublicEnrollmentUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly repository: EnrollmentRepositoryPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(RATE_LIMIT) private readonly limits: RateLimitPort,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly users: UserLookupService,
    private readonly outbox: OutboxDispatcher,
    private readonly condominiums: CondominiumLookupService,
  ) {}

  /** Returns the form token that lets this browser send the form. */
  async verify(code: string, ip: string | null): Promise<string> {
    await this.consume("verify", ip);
    const now = this.clock.now();
    const invite = /^\d{6}$/.test(code.trim())
      ? await this.repository.findOpenInviteByCode(code.trim(), now)
      : null;
    // A suspended condominium takes no sign-ups (same answer as a bad code).
    if (!invite || !(await this.activeCondominium(invite))) {
      throw AppException.from(APP_ERRORS.enrollment.invalidCode, undefined);
    }
    return this.signFormToken(
      invite.id,
      new Date(now.getTime() + FORM_TTL_MINUTES * 60_000),
    );
  }

  /**
   * Checks that a form token is still valid and tells the form which
   * condominium it is for and which units to offer.
   */
  async form(formToken: string): Promise<EnrollmentForm> {
    const invite = await this.openInvite(formToken);
    const condominium = await this.activeCondominium(invite);
    if (!condominium) {
      throw AppException.from(APP_ERRORS.enrollment.formExpired, undefined);
    }
    const units = await this.condominiums.unitsOf(invite.condominiumId);
    return {
      condominiumName: condominium.name,
      units: units.map((unit) => ({ id: unit.id, label: unitLabel(unit) })),
    };
  }

  async submit(
    formToken: string,
    input: EnrollmentInput,
    consent: boolean,
    ip: string | null,
    /** Optional profile photo, base64 (the browser already resized it). */
    photo?: string | null,
  ): Promise<void> {
    const invite = await this.openInvite(formToken);
    const condominium = await this.activeCondominium(invite);
    if (!condominium) {
      throw AppException.from(APP_ERRORS.enrollment.formExpired, undefined);
    }
    if (!consent) {
      throw AppException.from(APP_ERRORS.enrollment.consentRequired, undefined);
    }
    await this.consume("submit", ip);
    // Only the public form: on approval the manager's spelling is kept
    // (exceptions like "McDonald" stay possible).
    const data = validateEnrollment({
      ...input,
      fullName: capitalizeFullName(input.fullName),
    });

    const unitId = await this.formUnit(invite.condominiumId, input.unitId);

    // Someone with a Dora account elsewhere may join this condominium too.
    if (await this.users.isMemberEmail(data.email, invite.condominiumId)) {
      throw AppException.from(APP_ERRORS.enrollment.alreadyUser, undefined);
    }
    if (
      await this.repository.findPending({
        email: data.email,
        condominiumId: invite.condominiumId,
      })
    ) {
      throw AppException.from(APP_ERRORS.enrollment.alreadyPending, undefined);
    }

    // Checked by its content and re-encoded before anything is stored.
    let photoKey: string | null = null;
    if (photo) {
      const raw = decodePhoto(photo);
      const image = raw ? await this.images.profilePhoto(raw) : null;
      if (!image) {
        throw AppException.from(APP_ERRORS.enrollment.invalidPhoto, undefined);
      }
      photoKey = enrollmentPhotoKey(randomUUID());
      await this.storage.put(photoKey, image.data, image.contentType);
    }
    // The condominium's managers review it (each one is told by app and
    // e-mail); with no manager yet, the platform administrators are.
    let reviewers = await this.users.activeMemberIds(
      invite.condominiumId,
      UserGroup.ADMIN,
    );
    if (reviewers.length === 0) {
      reviewers = await this.users.activeUserIdsInGroup(UserGroup.ADMIN_MASTER);
    }
    try {
      await this.repository.createRequest(
        {
          ...data,
          unitId,
          condominiumId: invite.condominiumId,
          inviteId: invite.id,
          consentAt: this.clock.now(),
          photoKey,
        },
        (requestId) =>
          reviewers.map((userId) =>
            deliveryDraft(
              submittedNotice(userId, data, condominium.name),
              `enrollment:${requestId}:${userId}`,
            ),
          ),
      );
    } catch (error) {
      if (photoKey) await this.storage.deleteMany([photoKey]).catch(() => {});
      throw error;
    }
    if (reviewers.length > 0) this.outbox.kick();
  }

  private async activeCondominium(invite: EnrollmentInvite) {
    const condominium = await this.condominiums.find(invite.condominiumId);
    return condominium?.status === CondominiumStatus.ACTIVE
      ? condominium
      : null;
  }

  /** The unit picked on the form: required when the condominium has any. */
  private async formUnit(
    condominiumId: string,
    unitId: string | null | undefined,
  ): Promise<string | null> {
    if (unitId) {
      const unit = await this.condominiums.unitIn(condominiumId, unitId);
      if (unit) return unit.id;
    } else if ((await this.condominiums.unitsOf(condominiumId)).length === 0) {
      return null;
    }
    throw AppException.from(APP_ERRORS.enrollment.invalidUnit, undefined);
  }

  // The token carries the invite and its own expiry, signed with the
  // server's HMAC key: nothing to store, nothing to forge.
  private signFormToken(inviteId: string, expiresAt: Date): string {
    const payload = `${inviteId}.${expiresAt.getTime()}`;
    return `${Buffer.from(payload).toString("base64url")}.${this.secrets.digest(`enrollment:${payload}`)}`;
  }

  /** The invite behind a form token; the invite must not be revoked. */
  private async openInvite(formToken: string): Promise<EnrollmentInvite> {
    const expired = () =>
      AppException.from(APP_ERRORS.enrollment.formExpired, undefined);
    const [encoded, signature] = formToken.split(".");
    if (!encoded || !signature) throw expired();
    const payload = Buffer.from(encoded, "base64url").toString();
    if (
      !this.secrets.sameDigest(
        this.secrets.digest(`enrollment:${payload}`),
        signature,
      )
    ) {
      throw expired();
    }
    const [inviteId, expiresAtMs] = payload.split(".");
    const now = this.clock.now();
    if (!inviteId || Number(expiresAtMs) <= now.getTime()) throw expired();
    const invite = await this.repository.findInvite(inviteId);
    // An invite that expires while the form is open still accepts it; a
    // revoked one does not.
    if (!invite || invite.revokedAt) throw expired();
    return invite;
  }

  private async consume(action: keyof typeof LIMITS, ip: string | null) {
    const rule = LIMITS[action];
    const window = await this.limits.hit(
      `enrollment:${action}:${this.secrets.digest(ip ?? "unknown")}`,
      rule.windowMs,
    );
    // `hit` already counted this request: blocked only when it went over.
    const status = rateStatus(
      { ...window, count: window.count - 1 },
      rule,
      this.clock.now(),
    );
    if (status.blocked) {
      throw AppException.from(APP_ERRORS.identity.tooManyRequests, {
        minutes: status.retryAfterMinutes,
      });
    }
  }
}
