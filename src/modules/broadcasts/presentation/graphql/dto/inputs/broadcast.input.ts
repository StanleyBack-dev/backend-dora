import { Field, InputType } from "@nestjs/graphql";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { BroadcastAudience } from "@/modules/broadcasts/domain/broadcast";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";
import "@/modules/broadcasts/presentation/graphql/broadcasts.graphql-enums";

@InputType()
export class BroadcastInput {
  @Field()
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field()
  @IsString()
  @MaxLength(4000)
  body!: string;

  @Field(() => BroadcastAudience)
  @IsEnum(BroadcastAudience)
  audience!: BroadcastAudience;

  @Field(() => UserGroup, { nullable: true })
  @IsOptional()
  @IsEnum(UserGroup)
  targetGroup?: UserGroup | null;

  @Field({ description: "Também envia por e-mail." })
  @IsBoolean()
  sendEmail!: boolean;
}
