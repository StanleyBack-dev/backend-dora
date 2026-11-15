import { unitLabel } from "@/modules/condominiums/domain/unit";
import type { EnrollmentRequestView } from "@/modules/enrollment/application/ports/enrollment-repository.port";
import type { EnrollmentRequest } from "@/modules/enrollment/domain/enrollment";
import type { EnrollmentRequestType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-request.output";

export const toRequestType = (
  request: EnrollmentRequestView,
): EnrollmentRequestType & EnrollmentRequest => ({
  ...request,
  unitLabel:
    request.unitNumber !== null
      ? unitLabel({
          street: request.unitStreet,
          block: request.unitBlock ?? "",
          number: request.unitNumber,
        })
      : null,
  typedUnitLabel:
    request.typedUnitNumber !== null
      ? unitLabel({
          street: request.typedUnitStreet,
          block: request.typedUnitBlock ?? "",
          number: request.typedUnitNumber,
        })
      : null,
});
