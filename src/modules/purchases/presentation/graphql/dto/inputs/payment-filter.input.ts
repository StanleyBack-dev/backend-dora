import { Field, ID, InputType } from "@nestjs/graphql";
import { IsArray, IsEnum, IsOptional, IsUUID } from "class-validator";
import { InstallmentState } from "@/modules/purchases/domain/purchase-order";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@InputType({ description: "Filtros da página de pagamentos." })
export class PaymentFilterInput {
  @Field(() => [InstallmentState], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(InstallmentState, { each: true })
  states?: InstallmentState[];

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
