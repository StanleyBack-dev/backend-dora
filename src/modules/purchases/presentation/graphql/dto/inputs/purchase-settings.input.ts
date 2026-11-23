import { Field, Float, InputType } from "@nestjs/graphql";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import {
  APPROVAL_LIMITS,
  ApprovalMode,
} from "@/modules/purchases/domain/purchase-approval";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@InputType({ description: "Como o condomínio aprova as compras." })
export class PurchaseSettingsInput {
  @Field(() => ApprovalMode)
  @IsEnum(ApprovalMode)
  approvalMode!: ApprovalMode;

  @Field(() => Float, {
    nullable: true,
    description: "Com LIMIT: a alçada, em centavos.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(APPROVAL_LIMITS.maxLimitCents)
  approvalLimitCents?: number | null;
}
