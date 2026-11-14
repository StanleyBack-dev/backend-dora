import { Inject } from "@nestjs/common";
import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import type { UserAccount } from "@/modules/identity/application/ports/user-repository.port";
import { isLocked } from "@/modules/identity/domain/lockout-policy";
import { UserAccountType } from "@/modules/identity/presentation/graphql/dto/outputs/user-account.output";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// Derived fields of UserAccount: time-based state from the server clock (so
// clients never decide it) and the photo link, signed on demand.
@Resolver(() => UserAccountType)
export class UserAccountFieldsResolver {
  constructor(
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  @ResolveField(() => String, {
    nullable: true,
    description: "Link temporário da foto de perfil (null: sem foto).",
  })
  photoUrl(
    @Parent() account: Pick<UserAccountType, "avatarKey">,
  ): Promise<string | null> | null {
    return account.avatarKey
      ? this.storage.signedReadUrl(account.avatarKey)
      : null;
  }

  @ResolveField(() => Boolean, {
    description: "Bloqueado agora por tentativas inválidas de login.",
  })
  locked(@Parent() account: Pick<UserAccount, "lockedUntil">): boolean {
    return isLocked(
      { lockedUntil: account.lockedUntil, failedLoginAttempts: 0 },
      this.clock.now(),
    );
  }
}
