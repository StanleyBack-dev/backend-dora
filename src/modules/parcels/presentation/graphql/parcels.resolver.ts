import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import {
  CurrentRequestMeta,
  type RequestMeta,
} from "@/common/decorators/request-meta.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import { CloseParcelUseCase } from "@/modules/parcels/application/use-cases/close-parcel.use-case";
import { FindParcelByCodeUseCase } from "@/modules/parcels/application/use-cases/find-parcel-by-code.use-case";
import { ListParcelsUseCase } from "@/modules/parcels/application/use-cases/list-parcels.use-case";
import { PickUpParcelUseCase } from "@/modules/parcels/application/use-cases/pick-up-parcel.use-case";
import { RegisterParcelUseCase } from "@/modules/parcels/application/use-cases/register-parcel.use-case";
import { GetParcelReceiptPdfUseCase } from "@/modules/parcels/application/use-cases/get-parcel-receipt-pdf.use-case";
import { ParcelReceiptFileType } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel-receipt-file.output";
import { SearchParcelRecipientsUseCase } from "@/modules/parcels/application/use-cases/search-parcel-recipients.use-case";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import { ParcelFilterInput } from "@/modules/parcels/presentation/graphql/dto/inputs/parcel-filter.input";
import { PickUpParcelInput } from "@/modules/parcels/presentation/graphql/dto/inputs/pick-up-parcel.input";
import { RegisterParcelInput } from "@/modules/parcels/presentation/graphql/dto/inputs/register-parcel.input";
import { ParcelOverviewType } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel-overview.output";
import { ParcelPage } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel-page.output";
import { ParcelRecipientType } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel-recipient.output";
import { ParcelType } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel.output";
import { toParcelType } from "@/modules/parcels/presentation/graphql/parcel.mapper";
import type { Paginated } from "@/shared/application/pagination";
import "@/modules/parcels/presentation/graphql/parcels.graphql-enums";

const DEFAULT_PAGE = { page: 1, limit: 20 };

// Parcels of the session's condominium: the gate (Portaria) and the
// managers register, hand over (code + signature), return and cancel, and
// see every parcel; residents see their unit's.
@RequireModule(AppModule.PARCELS)
@Resolver()
export class ParcelsResolver {
  constructor(
    private readonly access: ParcelAccessService,
    private readonly listing: ListParcelsUseCase,
    private readonly finding: FindParcelByCodeUseCase,
    private readonly registering: RegisterParcelUseCase,
    private readonly pickingUp: PickUpParcelUseCase,
    private readonly closing: CloseParcelUseCase,
    private readonly recipients: SearchParcelRecipientsUseCase,
    private readonly receipts: GetParcelReceiptPdfUseCase,
  ) {}

  @Query(() => ParcelReceiptFileType, {
    description:
      "Comprovante de retirada em PDF (portaria e gestores, ou o morador que vê a encomenda).",
  })
  parcelReceiptPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<ParcelReceiptFileType> {
    return this.receipts.execute(actor, id);
  }

  @Query(() => ParcelPage, { description: "Encomendas da minha unidade." })
  async myParcels(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("statuses", { type: () => [ParcelStatus], nullable: true })
    statuses?: ParcelStatus[] | null,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<ParcelType>> {
    const found = await this.listing.mine(
      actor,
      statuses?.length ? statuses : null,
      page ?? DEFAULT_PAGE,
    );
    return { ...found, items: found.items.map(toParcelType) };
  }

  @RequirePermissions(Permission.PARCELS_MANAGE)
  @Query(() => ParcelPage, {
    description: "Encomendas do condomínio, com filtros, por página.",
  })
  async parcels(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: ParcelFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<ParcelType>> {
    const found = await this.listing.all(
      actor,
      {
        statuses: filter?.statuses?.length ? filter.statuses : null,
        unitId: filter?.unitId ?? null,
        search: filter?.search?.trim() || null,
        recipientName: filter?.recipientName?.trim() || null,
        carrier: filter?.carrier?.trim() || null,
        trackingCode: filter?.trackingCode?.trim() || null,
        perishable: filter?.perishable ?? false,
        from: filter?.from ?? null,
        to: filter?.to ?? null,
      },
      page ?? DEFAULT_PAGE,
    );
    return { ...found, items: found.items.map(toParcelType) };
  }

  @RequirePermissions(Permission.PARCELS_MANAGE)
  @Query(() => ParcelOverviewType, {
    description: "As encomendas do condomínio em números.",
  })
  parcelOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ParcelOverviewType> {
    return this.listing.overview(actor);
  }

  @Query(() => ParcelType, {
    description:
      "Uma encomenda (portaria e gestores: qualquer uma; morador: as da sua unidade).",
  })
  async parcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<ParcelType> {
    return toParcelType(await this.access.loadVisible(actor, id));
  }

  @RequirePermissions(Permission.PARCELS_MANAGE)
  @Query(() => ParcelType, {
    description: "A encomenda de um código de retirada (digitado ou do QR).",
  })
  async parcelByCode(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("code") code: string,
  ): Promise<ParcelType> {
    return toParcelType(await this.finding.execute(actor, code.slice(0, 20)));
  }

  @RequirePermissions(Permission.PARCELS_MANAGE)
  @Query(() => [ParcelRecipientType], {
    description:
      "Moradores (com unidade) pelo nome, para registrar uma encomenda (até 20; mínimo de 2 letras).",
  })
  parcelRecipients(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("search") search: string,
  ): Promise<ParcelRecipientType[]> {
    return this.recipients.execute(actor, search.slice(0, 60));
  }

  @RequirePermissions(Permission.PARCELS_MANAGE)
  @Mutation(() => ParcelType, {
    description:
      "Registra uma encomenda recebida; os moradores da unidade recebem o código de retirada.",
  })
  async registerParcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: RegisterParcelInput,
  ): Promise<ParcelType> {
    return toParcelType(await this.registering.execute(actor, input));
  }

  @RequirePermissions(Permission.PARCELS_MANAGE)
  @Mutation(() => ParcelType, {
    description:
      "Entrega a encomenda pelo código, com a assinatura de quem retira feita na tela.",
  })
  async pickUpParcel(
    @CurrentUser() actor: AuthenticatedUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Args("input") input: PickUpParcelInput,
  ): Promise<ParcelType> {
    return toParcelType(
      await this.pickingUp.execute(
        actor,
        { ...input, device: input.device ? { ...input.device } : null },
        meta,
      ),
    );
  }

  @RequirePermissions(Permission.PARCELS_MANAGE)
  @Mutation(() => ParcelType, {
    description: "Devolve ao remetente uma encomenda que está na portaria.",
  })
  async returnParcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<ParcelType> {
    return toParcelType(
      await this.closing.execute(actor, id, ParcelStatus.RETURNED, reason),
    );
  }

  @RequirePermissions(Permission.PARCELS_MANAGE)
  @Mutation(() => ParcelType, {
    description: "Cancela uma encomenda registrada por engano.",
  })
  async cancelParcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<ParcelType> {
    return toParcelType(
      await this.closing.execute(actor, id, ParcelStatus.CANCELLED, reason),
    );
  }
}
