import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  ENROLLMENT_REPOSITORY,
  type EnrollmentRepositoryPort,
} from "@/modules/enrollment/application/ports/enrollment-repository.port";
import {
  INVITE_CODE_DIGITS,
  type EnrollmentInvite,
} from "@/modules/enrollment/domain/enrollment";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

@Injectable()
export class EnrollmentInvitesUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly repository: EnrollmentRepositoryPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly audit: AuditTrailService,
  ) {}

  list(actor: AuthenticatedUser): Promise<EnrollmentInvite[]> {
    return this.repository.listInvites(tenantOf(actor), 20);
  }

  async create(
    actor: AuthenticatedUser,
    input: { label: string; validDays: number },
  ): Promise<EnrollmentInvite> {
    const condominiumId = tenantOf(actor);
    const label = input.label.trim().replace(/\s+/g, " ");
    if (
      label.length < 2 ||
      label.length > 80 ||
      !Number.isInteger(input.validDays) ||
      input.validDays < 1 ||
      input.validDays > 30
    ) {
      throw AppException.from(APP_ERRORS.enrollment.invalidInvite, undefined);
    }
    const now = this.clock.now();
    // Two open invites never share a code, so a code finds one invite.
    let code = this.secrets.numericCode(INVITE_CODE_DIGITS);
    while (await this.repository.findOpenInviteByCode(code, now)) {
      code = this.secrets.numericCode(INVITE_CODE_DIGITS);
    }
    const invite = await this.repository.createInvite({
      condominiumId,
      code,
      label,
      expiresAt: new Date(now.getTime() + input.validDays * 86_400_000),
      createdBy: actor.id,
    });
    await this.audit.stamp({
      actorId: actor.id,
      entity: "enrollment_invite",
      entityId: invite.id,
      created: true,
    });
    return invite;
  }

  async revoke(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<EnrollmentInvite> {
    const invite = await this.repository.findInvite(id);
    if (!invite || invite.condominiumId !== tenantOf(actor)) {
      throw AppException.from(APP_ERRORS.enrollment.inviteNotFound, undefined);
    }
    if (invite.revokedAt) return invite;
    const revoked = await this.repository.revokeInvite(id, this.clock.now());
    await this.audit.stamp({
      actorId: actor.id,
      entity: "enrollment_invite",
      entityId: id,
    });
    return revoked;
  }
}
