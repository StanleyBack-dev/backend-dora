import { Paginated } from "@/common/graphql/pagination.graphql";
import { BrandType } from "@/modules/catalog/presentation/graphql/dto/outputs/brand.output";
import { ProductType } from "@/modules/catalog/presentation/graphql/dto/outputs/product.output";

export const ProductPage = Paginated(ProductType, "ProductPage");
export const BrandPage = Paginated(BrandType, "BrandPage");
