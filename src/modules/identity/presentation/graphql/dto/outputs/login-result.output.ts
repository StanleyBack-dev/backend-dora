import { Field, ObjectType } from "@nestjs/graphql";
import { SessionUserType } from "@/modules/identity/presentation/graphql/dto/outputs/session-user.output";
import { AuthTokensType } from "@/modules/identity/presentation/graphql/dto/outputs/auth-tokens.output";

@ObjectType("LoginResult")
export class LoginResultType extends AuthTokensType {
  @Field(() => SessionUserType)
  user!: SessionUserType;
}
