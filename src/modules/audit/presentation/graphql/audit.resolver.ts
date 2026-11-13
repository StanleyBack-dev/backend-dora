import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  isStampedEntity,
  type RecordStamp,
} from "@/modules/audit/domain/record-stamp";
import { STAMP_READ_PERMISSION } from "@/modules/audit/domain/record-stamp-access";
import { RecordStampType } from "@/modules/audit/presentation/graphql/dto/outputs/record-stamp.output";

@Resolver()
export class AuditResolver {
  constructor(
    private readonly audit: AuditTrailService,
    private readonly permissions: PermissionsService,
  ) {}

  @Query(() => RecordStampType, {
    nullable: true,
    description:
      "Criação e última alteração de um registro (null: não existe). Para todos; contas e cadastros só para quem gerencia usuários.",
  })
  async recordStamp(
    @CurrentUser() user: AuthenticatedUser,
    @Args("entity") entity: string,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<RecordStamp | null> {
    if (!isStampedEntity(entity) || !/^[0-9a-f-]{36}$/i.test(id)) {
      throw AppException.from(APP_ERRORS.audit.unknownRecord, undefined);
    }
    const required = STAMP_READ_PERMISSION[entity];
    if (
      required &&
      !(await this.permissions.effectiveFor(user)).has(required)
    ) {
      throw AppException.from(
        APP_ERRORS.accessControl.missingPermission,
        undefined,
        { missing: [required] },
      );
    }
    return this.audit.find(entity, id);
  }
}
