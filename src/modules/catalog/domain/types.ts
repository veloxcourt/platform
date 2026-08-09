// Dominio del Catálogo de productos.
// Montos en centavos (×100). marginPct en % ×100 (35,50% -> 3550).

export interface ProductType {
  id: string;
  name: string;
  active: boolean;
}

export interface ProductComponentLine {
  componentId: string;
  quantity: number;
  /** Nombre del componente (solo lectura / UI). */
  componentName?: string;
  /** Unidad del componente (solo lectura / UI). */
  componentUnit?: string;
  /** Cantidad base del componente (solo lectura / UI). */
  componentBaseQuantity?: number;
  /** Costo del componente en centavos (solo lectura / UI). */
  componentCost?: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  code: string | null;
  typeId: string | null;
  typeName: string | null;
  cost: number;
  marginPct: number;
  price: number;
  rounding: number;
  stock: number;
  isComposite: boolean;
  baseQuantity: number;
  unit: string;
  photoUrl: string | null;
  active: boolean;
  sortOrder: number;
  showInPriceMenu: boolean;
}

/// Producto vendible para el selector de venta.
export interface SellableProduct {
  id: string;
  name: string;
  price: number; // centavos
}
