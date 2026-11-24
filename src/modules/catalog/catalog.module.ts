import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { CatalogAccessService } from "@/modules/catalog/application/catalog-access.service";
import { BRAND_REPOSITORY } from "@/modules/catalog/application/ports/brand-repository.port";
import { PRODUCT_REPOSITORY } from "@/modules/catalog/application/ports/product-repository.port";
import { ListBrandsUseCase } from "@/modules/catalog/application/use-cases/list-brands.use-case";
import { ListProductsUseCase } from "@/modules/catalog/application/use-cases/list-products.use-case";
import { SaveBrandUseCase } from "@/modules/catalog/application/use-cases/save-brand.use-case";
import { SaveProductUseCase } from "@/modules/catalog/application/use-cases/save-product.use-case";
import { BrandSqlRepository } from "@/modules/catalog/infrastructure/persistence/brand-sql.repository";
import { ProductSqlRepository } from "@/modules/catalog/infrastructure/persistence/product-sql.repository";
import { BrandsResolver } from "@/modules/catalog/presentation/graphql/brands.resolver";
import { ProductsResolver } from "@/modules/catalog/presentation/graphql/products.resolver";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";

/**
 * The condominium's catalog (products and brands), shared by the modules
 * that deal with things: purchases now, stock or maintenance later. It is
 * no paid module of its own; it opens to the modules listed in
 * CatalogAccessService. The repositories are exported so those modules
 * check what their records point to.
 */
@Module({
  imports: [AccessControlModule, AuditModule, CondominiumsModule],
  providers: [
    CatalogAccessService,
    ListProductsUseCase,
    SaveProductUseCase,
    ListBrandsUseCase,
    SaveBrandUseCase,
    ProductsResolver,
    BrandsResolver,
    { provide: PRODUCT_REPOSITORY, useClass: ProductSqlRepository },
    { provide: BRAND_REPOSITORY, useClass: BrandSqlRepository },
  ],
  exports: [PRODUCT_REPOSITORY, BRAND_REPOSITORY],
})
export class CatalogModule {}
