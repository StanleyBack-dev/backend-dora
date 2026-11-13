import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  ENROLLMENT_REPOSITORY,
  type EnrollmentRepositoryPort,
  type EnrollmentRequestFilter,
  type EnrollmentRequestView,
} from "@/modules/enrollment/application/ports/enrollment-repository.port";
import {
  EnrollmentStatus,
  type EnrollmentRequest,
} from "@/modules/enrollment/domain/enrollment";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import {
  ManageUsersUseCase,
  type TemporaryAccess,
} from "@/modules/identity/application/use-cases/manage-users.use-case";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import {
  EnrollmentInput,
  validateEnrollment,
} from "@/modules/enrollment/application/enrollment-input";

export type EnrollmentApproval = {
  request: EnrollmentRequestView;
  access: TemporaryAccess;
};

@Injectable()
export class EnrollmentReviewUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly repository: EnrollmentRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly users: UserLookupService,
    private readonly manageUsers: ManageUsersUseCase,
    private readonly audit: AuditTrailService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  private readonly logger = new Logger(EnrollmentReviewUseCase.name);

  /** Short-lived link to the photo, for the review (null: none). */
  async photoUrl(request: EnrollmentRequest): Promise<string | null> {
    return request.photoKey
      ? this.storage.signedReadUrl(request.photoKey)
      : null;
  }

  list(
    actor: AuthenticatedUser,
    filter: Omit<EnrollmentRequestFilter, "condominiumId">,
    page: PageRequest,
  ): Promise<Paginated<EnrollmentRequestView>> {
    return this.repository.pageRequests(
      { ...filter, condominiumId: tenantOf(actor) },
      page,
    );
  }

  countPending(actor: AuthenticatedUser): Promise<number> {
    return this.repository.countPending(tenantOf(actor));
  }

  async get(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<EnrollmentRequestView> {
    const request = await this.repository.findRequest(id);
    // Another condominium's request is "not found" here.
    if (!request || request.condominiumId !== tenantOf(actor)) {
      throw AppException.from(APP_ERRORS.enrollment.notFound, undefined);
    }
    return request;
  }

  /**
   * Adds the person to the condominium through the regular flow, with the
   * data as the manager corrected it and the role the manager chose: a new
   * account gets a temporary password by e-mail and a login derived from the
   * name ("ana.souza", "ana.souza2"…); an e-mail that already has a Dora
   * account just gains this condominium.
   */
  async approve(
    actor: AuthenticatedUser,
    id: string,
    input: EnrollmentInput,
    group: UserGroup,
  ): Promise<EnrollmentApproval> {
    const request = await this.pending(actor, id);
    const data = validateEnrollment(input);
    const unitId = input.unitId === undefined ? request.unitId : input.unitId;

    const access = await this.manageUsers.create(actor, {
      name: data.fullName,
      email: data.email,
      group,
      unitId,
    });
    // The photo sent with the sign-up becomes the account's photo, unless
    // an existing account already has one.
    if (request.photoKey && !(await this.users.avatarKeyOf(access.user.id))) {
      await this.users.setAvatarKey(access.user.id, request.photoKey);
    }

    const approved = await this.repository.updateRequest(id, {
      ...data,
      unitId,
      status: EnrollmentStatus.APROVADA,
      reviewedBy: actor.id,
      reviewedAt: this.clock.now(),
      userId: access.user.id,
    });
    await this.audit.stamp({
      actorId: actor.id,
      entity: "enrollment_request",
      entityId: id,
    });
    return { request: approved, access };
  }

  async reject(
    actor: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<EnrollmentRequestView> {
    const request = await this.pending(actor, id);
    const text = reason.trim().replace(/\s+/g, " ");
    if (text.length < 3 || text.length > 500) {
      throw AppException.from(APP_ERRORS.enrollment.invalidReason, undefined);
    }
    const rejected = await this.repository.updateRequest(id, {
      status: EnrollmentStatus.RECUSADA,
      reviewedBy: actor.id,
      reviewedAt: this.clock.now(),
      rejectionReason: text,
      // A rejected sign-up keeps no photo (it never became an account).
      photoKey: null,
    });
    if (request.photoKey) {
      await this.storage
        .deleteMany([request.photoKey])
        .catch((error) =>
          this.logger.warn(
            `Foto do cadastro ${id} não removida: ${String(error)}`,
          ),
        );
    }
    await this.audit.stamp({
      actorId: actor.id,
      entity: "enrollment_request",
      entityId: id,
    });
    return rejected;
  }

  private async pending(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<EnrollmentRequestView> {
    const request = await this.get(actor, id);
    if (request.status !== EnrollmentStatus.PENDENTE) {
      throw AppException.from(APP_ERRORS.enrollment.notPending, undefined);
    }
    return request;
  }
}
