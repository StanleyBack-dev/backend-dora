import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType("AuthTokens")
export class AuthTokensType {
  @Field()
  accessToken!: string;

  @Field()
  accessTokenExpiresAt!: Date;

  @Field()
  refreshToken!: string;

  @Field()
  refreshTokenExpiresAt!: Date;
}
