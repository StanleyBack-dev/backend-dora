import { Paginated } from "@/common/graphql/pagination.graphql";
import { SupplierType } from "@/modules/purchases/presentation/graphql/dto/outputs/supplier.output";

export const SupplierPage = Paginated(SupplierType, "SupplierPage");
