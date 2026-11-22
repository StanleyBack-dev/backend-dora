import { Field, ID, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from "class-validator";
import { Category } from "@/modules/catalog/domain/category";
import {
  PurchasePriority,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@InputType({ description: "Filtros das solicitações de compra." })
export class PurchaseRequestFilterInput {
  @Field(() => ID, {
    nullable: true,
    description: "Exatamente esta solicitação.",
  })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @Field(() => ID, { nullable: true, description: "Feitas por esta pessoa." })
  @IsOptional()
  @IsUUID()
  requestedById?: string;

  @Field(() => Category, {
    nullable: true,
    description: "Com esta categoria entre as suas.",
  })
  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @Field(() => PurchasePriority, { nullable: true })
  @IsOptional()
  @IsEnum(PurchasePriority)
  priority?: PurchasePriority;

  @Field(() => [PurchaseRequestStatus], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsEnum(PurchaseRequestStatus, { each: true })
  statuses?: PurchaseRequestStatus[];
}
