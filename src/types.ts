export type I18n = Partial<Record<"ru" | "en" | "ka", string>>;
export interface SessionUser {
  id: string;
  username: string;
  role: "root" | "admin" | "user";
  email?: string | null;
  emailVerified?: boolean;
  customerId?: string | null;
}
export interface Category {
  id: string;
  parentId?: string | null;
  nameI18n: I18n;
  slug: string;
  isActive: boolean;
}
export interface Product {
  id: string;
  categoryId: string | null;
  nameI18n: I18n;
  descriptionI18n: I18n;
  slug: string;
  brandName: string | null;
  attributes: Record<string, unknown>;
  status: string;
  createdAt: string;
}
export interface Variant {
  id: string;
  productId: string;
  unitId: string;
  sku: string;
  nameI18n: I18n;
  attributes: Record<string, unknown>;
  price: string;
  currency: string;
  isActive: boolean;
}
export interface ProductVariantImage {
  id: string;
  productVariantId: string;
  imageUrl: string;
}
export interface Unit {
  id: string;
  symbolI18n: I18n;
  allowsFraction: boolean;
  isActive: boolean;
}
export interface Inventory {
  variantId: string;
  availableQty: string;
}
export interface Catalog {
  products: Product[];
  categories: Category[];
  variants: Variant[];
  units: Unit[];
  inventory: Inventory[];
}
export interface CartLine {
  variantId: string;
  quantity: number;
}
export interface OrderInput {
  items: { variantId: string; quantity: string }[];
  deliveryMethod: "delivery" | "pickup";
  deliveryAddress?: {
    city: string;
    addressLine: string;
    apartment?: string;
    recipientName: string;
    recipientPhone: string;
  };
  customerNote: string;
}
export interface Order {
  id: string;
  orderNumber: string;
  grandTotal: string;
  deliveryTotal: string;
  currency: string;
  status: string;
}
