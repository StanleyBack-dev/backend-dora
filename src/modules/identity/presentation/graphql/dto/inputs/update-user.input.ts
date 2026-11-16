import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";
import { Type } from "class-transformer";
import { MemberKind } from "@/modules/identity/domain/member-profile";
import { EmployeeProfileInput } from "@/modules/identity/presentation/graphql/dto/inputs/employee-profile.input";
import "@/modules/identity/presentation/graphql/identity.graphql-enums";

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Field(() => UserGroup, { nullable: true })
  @IsOptional()
  @IsEnum(UserGroup)
  group?: UserGroup;

  @Field(() => MemberKind, {
    nullable: true,
    description: "Ausente: não muda.",
  })
  @IsOptional()
  @IsEnum(MemberKind)
  kind?: MemberKind;

  @Field(() => ID, {
    nullable: true,
    description: "Ausente: não muda. null: sem unidade.",
  })
  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Complemento do endereço no condomínio ("casa dos fundos").',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  unitComplement?: string | null;

  @Field(() => EmployeeProfileInput, {
    nullable: true,
    description: "Só para funcionários.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeProfileInput)
  employee?: EmployeeProfileInput | null;

  @Field(() => String, { nullable: true, description: "Telefone de contato." })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}
