import { randomUUID } from "crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { DependentAccessService } from "@/modules/dependents/application/dependent-access.service";
import { submittedNotices } from "@/modules/dependents/application/dependent-notices";
import {
  DEPENDENT_REPOSITORY,
  type DependentRepositoryPort,
} from "@/modules/dependents/application/ports/dependent-repository.port";
import {
  DEPENDENT_VIOLATION_MESSAGES,
  DEPENDENTS_MAX,
  normalizeDependent,
  type Dependent,
  type DependentInput,
} from "@/modules/dependents/domain/dependent";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { prepareDocument } from "@/shared/application/document-file";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import { localDay } from "@/shared/domain/birth-date";

// A resident registers a dependent with the document that proves the birth
// date (certidão, RG: image or PDF). It waits for the managers' approval;
// they are told by app and e-mail.
@Injectable()
export class AddDependentUseCase {
  private readonly logger = new Logger(AddDependentUseCase.name);

  constructor(
    @Inject(DEPENDENT_REPOSITORY)
    private readonly dependents: DependentRepositoryPort,
    private readonly access: DependentAccessService,
    private readonly users: UserLookupService,
    private readonly outbox: OutboxDispatcher,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: DependentInput,
    document: string,
  ): Promise<Dependent> {
    const { condominiumId, membershipId } = this.access.membershipOf(actor);
    const data = normalizeDependent(
      input,
      localDay(this.clock.now(), this.clock.timeZone),
    );
    if (typeof data === "string") {
      throw AppException.from(APP_ERRORS.dependents.invalid, {
        reason: DEPENDENT_VIOLATION_MESSAGES[data],
      });
    }
    if (
      (await this.dependents.countByMembership(membershipId)) >= DEPENDENTS_MAX
    ) {
      throw AppException.from(APP_ERRORS.dependents.tooMany, undefined);
    }
    const file = await prepareDocument(this.images, document);
    if (!file) {
      throw AppException.from(APP_ERRORS.dependents.invalidDocument, undefined);
    }

    const key = `dependent-documents/${condominiumId}/${membershipId}/${randomUUID()}.${file.extension}`;
    await this.storage.put(key, file.data, file.contentType);
    const managers = (
      await this.users.activeMemberIds(condominiumId, UserGroup.ADMIN)
    ).filter((userId) => userId !== actor.id);
    try {
      const created = await this.dependents.create(
        {
          ...data,
          condominiumId,
          membershipId,
          documentKey: key,
          documentContentType: file.contentType,
          createdBy: actor.id,
        },
        submittedNotices(
          { ...data, holderName: actor.name, unitLabel: null },
          managers,
          key,
        ),
      );
      this.outbox.kick();
      return created;
    } catch (error) {
      await this.storage.deleteMany([key]).catch(() => {});
      this.logger.warn(`Dependent not saved: ${String(error)}`);
      throw error;
    }
  }
}
