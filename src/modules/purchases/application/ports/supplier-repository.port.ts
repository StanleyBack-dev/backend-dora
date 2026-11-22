import type { PurchaseCategory } from "@/modules/purchases/domain/purchase-category";
import type {
  Supplier,
  SupplierDocumentType,
} from "@/modules/purchases/domain/supplier";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import type { PixKeyType } from "@/shared/domain/pix";

/** A supplier's form, already checked and normalized. */
export type SupplierData = {
  documentType: SupplierDocumentType;
  document: string;
  name: string;
  tradeName: string | null;
  categories: PurchaseCategory[];
  categoryOther: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  pixKeyType: PixKeyType | null;
  pixKey: string | null;
  notes: string | null;
};

export type SupplierFilter = {
  /** Exactly this supplier (the "Nome" filter). */
  supplierId?: string;
  /** Exactly this contact name. */
  contactName?: string;
  /** Exactly this CNPJ/CPF (digits). */
  document?: string;
  category?: PurchaseCategory;
  /** true: active only; false: inactive only; undefined: both. */
  active?: boolean;
};

/** What the filters offer: the values in use in the condominium. */
export type SupplierFilterOptions = {
  suppliers: { id: string; name: string }[];
  contacts: string[];
  documents: { documentType: SupplierDocumentType; document: string }[];
};

/** The suppliers in numbers (the page's cards), whatever the filters. */
export type SupplierOverview = {
  active: number;
  inactive: number;
  /** Active ones without a PIX key to pay them. */
  activeWithoutPix: number;
  /** Active ones without a phone nor an e-mail. */
  activeWithoutContact: number;
  /** Categories served by at least one active supplier. */
  categoriesServed: number;
};

export interface SupplierRepositoryPort {
  create(condominiumId: string, data: SupplierData): Promise<Supplier>;
  update(id: string, data: SupplierData): Promise<Supplier>;
  setActive(id: string, active: boolean): Promise<Supplier>;
  find(condominiumId: string, id: string): Promise<Supplier | null>;
  /** The supplier with this document in the condominium (null: none). */
  findByDocument(
    condominiumId: string,
    document: string,
  ): Promise<Supplier | null>;
  /** The filters' options (every supplier, active or not). */
  filterOptions(condominiumId: string): Promise<SupplierFilterOptions>;
  /** The suppliers in numbers. */
  overview(condominiumId: string): Promise<SupplierOverview>;
  /** The condominium's suppliers, active first, by name. */
  list(
    condominiumId: string,
    filter: SupplierFilter,
    page: PageRequest,
  ): Promise<Paginated<Supplier>>;
}

export const SUPPLIER_REPOSITORY = Symbol("SUPPLIER_REPOSITORY");
