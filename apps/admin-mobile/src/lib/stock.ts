import { Product } from "../types/domain";

export type SalePresentation = "caja" | "sobre" | "unidad";

interface StockValidation {
  ok: boolean;
  boxesNeeded: number;
  message: string;
}

export const normalizePresentation = (value: string): SalePresentation => {
  const normalized = String(value || "").toLowerCase().trim();
  if (normalized === "caja" || normalized === "sobre" || normalized === "unidad") {
    return normalized;
  }
  return "caja";
};

export const boxesNeededForSale = (
  product: Product,
  presentation: SalePresentation,
  quantity: number
) => {
  const qty = Number(quantity) || 0;
  if (qty <= 0) {
    return 0;
  }

  if (presentation === "caja") {
    return qty;
  }

  const sobresPerBox = Number(product.sobresXCaja) || 0;
  const unitsPerSobre = Number(product.unidadesXSobre) || 0;

  if (presentation === "sobre") {
    if (sobresPerBox <= 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.ceil(qty / sobresPerBox);
  }

  const unitsPerBox = sobresPerBox * unitsPerSobre;
  if (unitsPerBox <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.ceil(qty / unitsPerBox);
};

export const validateStockForSaleItem = (
  product: Product,
  presentation: SalePresentation,
  quantity: number
): StockValidation => {
  const boxesNeeded = boxesNeededForSale(product, presentation, quantity);
  if (!Number.isFinite(boxesNeeded) || boxesNeeded <= 0) {
    return {
      ok: false,
      boxesNeeded: 0,
      message: "Presentacion no valida para este producto.",
    };
  }

  const currentStock = Number(product.stockCajas) || 0;
  if (currentStock < boxesNeeded) {
    return {
      ok: false,
      boxesNeeded,
      message: `Stock insuficiente: requiere ${boxesNeeded} caja(s), hay ${currentStock}.`,
    };
  }

  return { ok: true, boxesNeeded, message: "" };
};

export const decreaseStock = (
  product: Product,
  presentation: SalePresentation,
  quantity: number
) => {
  const validation = validateStockForSaleItem(product, presentation, quantity);
  if (!validation.ok) {
    return validation;
  }
  product.stockCajas = Math.max(0, (Number(product.stockCajas) || 0) - validation.boxesNeeded);
  return validation;
};

export const increaseStock = (
  product: Product,
  presentation: SalePresentation,
  quantity: number
) => {
  const boxesToRestore = boxesNeededForSale(product, presentation, quantity);
  if (!Number.isFinite(boxesToRestore) || boxesToRestore <= 0) {
    return {
      ok: false,
      boxesNeeded: 0,
      message: "No se pudo calcular cajas para revertir.",
    };
  }
  product.stockCajas = (Number(product.stockCajas) || 0) + boxesToRestore;
  return {
    ok: true,
    boxesNeeded: boxesToRestore,
    message: "",
  };
};

