import { Paginated } from "@/common/graphql/pagination.graphql";
import { UserAccountType } from "@/modules/identity/presentation/graphql/dto/outputs/user-account.output";

export const UserAccountPage = Paginated(UserAccountType, "UserAccountPage");
