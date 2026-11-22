import { Paginated } from "@/common/graphql/pagination.graphql";
import { SupplierType } from "@/modules/suppliers/presentation/graphql/dto/outputs/supplier.output";

export const SupplierPage = Paginated(SupplierType, "SupplierPage");
