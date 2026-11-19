import { Paginated } from "@/common/graphql/pagination.graphql";
import { LandingLeadType } from "@/modules/landing/presentation/graphql/dto/outputs/landing-lead.output";

export const LandingLeadPage = Paginated(LandingLeadType, "LandingLeadPage");
