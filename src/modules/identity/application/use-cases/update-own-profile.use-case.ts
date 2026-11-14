import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import type { User } from "@/modules/identity/domain/user";
import { normalizeEmail } from "@/modules/identity/domain/username";
import { normalizePhone } from "@/shared/domain/phone";

@Injectable()
export class UpdateOwnProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    /** phone: undefined keeps it; null or "" removes it. */
    input: { name: string; email: string; phone?: string | null },
  ): Promise<User> {
    const before = await this.users.findById(actor.id);
    if (!before) {
      throw AppException.from(APP_ERRORS.identity.userNotFound, undefined);
    }

    const email = normalizeEmail(input.email);
    if (email !== before.email) {
      const owner = await this.users.findByEmail(email);
      if (owner && owner.id !== actor.id) {
        throw AppException.from(APP_ERRORS.identity.emailTaken, undefined);
      }
    }

    const name = input.name.trim();
    const updated = await this.users.update(actor.id, {
      name,
      email,
      phone: this.phone(input.phone),
    });
    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: actor.id,
    });
    return updated;
  }

  private phone(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value.trim() === "") return null;
    const phone = normalizePhone(value);
    if (!phone) {
      throw AppException.from(APP_ERRORS.identity.invalidPhone, undefined);
    }
    return phone;
  }
}
