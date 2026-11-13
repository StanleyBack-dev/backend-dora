import { Field, ObjectType } from "@nestjs/graphql";
import { TemporaryAccessType } from "@/modules/identity/presentation/graphql/dto/outputs/temporary-access.output";
import { EnrollmentRequestType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-request.output";

@ObjectType("EnrollmentApproval")
export class EnrollmentApprovalType {
  @Field(() => EnrollmentRequestType)
  request!: EnrollmentRequestType;

  @Field(() => TemporaryAccessType)
  access!: TemporaryAccessType;
}
