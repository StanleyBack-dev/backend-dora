import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { EnrollmentReviewUseCase } from "@/modules/enrollment/application/use-cases/enrollment-review.use-case";
import type { EnrollmentRequest } from "@/modules/enrollment/domain/enrollment";
import { EnrollmentRequestType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-request.output";

// The photo link is signed on demand (it expires), never stored.
@Resolver(() => EnrollmentRequestType)
export class EnrollmentRequestFieldsResolver {
  constructor(private readonly review: EnrollmentReviewUseCase) {}

  @ResolveField(() => String, { nullable: true })
  photoUrl(@Parent() request: EnrollmentRequest): Promise<string | null> {
    return this.review.photoUrl(request);
  }
}
