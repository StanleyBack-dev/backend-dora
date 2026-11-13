import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { Public } from "@/common/decorators/public.decorator";
import {
  CurrentRequestMeta,
  type RequestMeta,
} from "@/common/decorators/request-meta.decorator";
import {
  PublicEnrollmentUseCase,
  type EnrollmentForm,
} from "@/modules/enrollment/application/use-cases/public-enrollment.use-case";
import { EnrollmentFormType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-form.output";
import { SubmitEnrollmentInput } from "@/modules/enrollment/presentation/graphql/dto/inputs/submit-enrollment.input";

// Public side: the code opens the form, the form becomes a pending request.
@Resolver()
export class PublicEnrollmentResolver {
  constructor(private readonly enrollment: PublicEnrollmentUseCase) {}

  @Public()
  @Mutation(() => String, {
    description:
      "Confere o código de convite e devolve o token do formulário (vale 60 min).",
  })
  verifyEnrollmentCode(
    @Args("code") code: string,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<string> {
    return this.enrollment.verify(code.slice(0, 12), meta.ipAddress);
  }

  @Public()
  @Query(() => EnrollmentFormType, {
    description:
      "Confere se o token do formulário ainda vale e diz o condomínio e as unidades.",
  })
  enrollmentForm(
    @Args("formToken") formToken: string,
  ): Promise<EnrollmentForm> {
    return this.enrollment.form(formToken.slice(0, 300));
  }

  @Public()
  @Mutation(() => Boolean, {
    description: "Envia o cadastro, que aguarda a aprovação da administração.",
  })
  async submitEnrollment(
    @Args("input") input: SubmitEnrollmentInput,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<boolean> {
    await this.enrollment.submit(
      input.formToken,
      input.data,
      input.consent,
      meta.ipAddress,
      input.photo,
    );
    return true;
  }
}
