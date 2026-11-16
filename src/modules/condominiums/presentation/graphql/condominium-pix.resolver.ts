import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { CondominiumPixUseCase } from "@/modules/condominiums/application/use-cases/condominium-pix.use-case";
import { PixReceiverInput } from "@/modules/condominiums/presentation/graphql/dto/inputs/pix-receiver.input";
import { PixReceiverType } from "@/modules/condominiums/presentation/graphql/dto/outputs/pix-receiver.output";
import type { PixReceiver } from "@/shared/domain/pix";

// The condominium's PIX, kept by whoever manages payments.
@Resolver()
export class CondominiumPixResolver {
  constructor(private readonly pix: CondominiumPixUseCase) {}

  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @Query(() => PixReceiverType, {
    nullable: true,
    description: "O PIX do condomínio (nulo: ainda não cadastrado).",
  })
  condominiumPix(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PixReceiver | null> {
    return this.pix.get(actor);
  }

  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @Mutation(() => PixReceiverType, {
    description: "Cadastra ou troca o PIX do condomínio.",
  })
  setCondominiumPix(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: PixReceiverInput,
  ): Promise<PixReceiver> {
    return this.pix.set(actor, input);
  }

  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @Mutation(() => Boolean, { description: "Remove o PIX do condomínio." })
  removeCondominiumPix(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<boolean> {
    return this.pix.remove(actor);
  }
}
