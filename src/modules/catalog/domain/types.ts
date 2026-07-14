// Dominio del Catálogo de productos.
// Montos en centavos (×100). marginPct en % ×100 (35,50% -> 3550).

export interface ProductType {
  id: string;
  name: string;
  active: boolean;
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
  photoUrl: string | null;
  active: boolean;
}

/// Producto vendible para el selector de venta.
export interface SellableProduct {
  id: string;
  name: string;
  price: number; // centavos
}
