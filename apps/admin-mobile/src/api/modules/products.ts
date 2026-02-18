import { request } from "../client";
import { Product, ProductPayload } from "../../types/domain";

const normalizeProduct = (raw: Product): Product => ({
  ...raw,
  precioCaja: Number(raw.precioCaja) || 0,
  precioSobre: Number(raw.precioSobre) || 0,
  precioUnidad: Number(raw.precioUnidad) || 0,
  sobresXCaja: Number(raw.sobresXCaja) || 0,
  unidadesXSobre: Number(raw.unidadesXSobre) || 0,
  stockCajas: Number(raw.stockCajas) || 0,
  ofertaPrecioCaja: Number(raw.ofertaPrecioCaja) || 0,
  ofertaPrecioSobre: Number(raw.ofertaPrecioSobre) || 0,
  ofertaActiva: Boolean(raw.ofertaActiva),
});

const toNumericId = (id: number | string) => {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const listProducts = async () => {
  const pageSize = 100;
  const firstPayload = await request<
    Product[] | { items?: Product[]; totalPages?: number; total?: number; limit?: number }
  >({
    url: `/products?page=1&limit=${pageSize}`,
    method: "GET",
  });

  let rows = Array.isArray(firstPayload)
    ? firstPayload
    : Array.isArray(firstPayload?.items)
    ? firstPayload.items
    : [];

  if (!Array.isArray(firstPayload) && Array.isArray(firstPayload?.items)) {
    const firstLimit = Math.max(1, Number(firstPayload.limit) || pageSize);
    const totalPages =
      Number.isFinite(Number(firstPayload.totalPages)) && Number(firstPayload.totalPages) > 0
        ? Number(firstPayload.totalPages)
        : Number(firstPayload.total) > 0
        ? Math.ceil(Number(firstPayload.total) / firstLimit)
        : 1;

    for (let page = 2; page <= totalPages; page++) {
      const payload = await request<Product[] | { items?: Product[] }>({
        url: `/products?page=${page}&limit=${firstLimit}`,
        method: "GET",
      });
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
        ? payload.items
        : [];
      if (items.length) rows = rows.concat(items);
    }
  }

  return rows.map(normalizeProduct);
};

export const createProduct = (payload: ProductPayload) =>
  request<{ id: number }>({
    url: "/products",
    method: "POST",
    data: payload,
  });

export const updateProductById = (id: number, payload: ProductPayload) =>
  request<{ ok: true }>({
    url: `/products/${id}`,
    method: "PUT",
    data: payload,
  });

export const updateProductByExternalId = (externalId: string, payload: ProductPayload) =>
  request<{ ok: true }>({
    url: `/products/external/${encodeURIComponent(externalId)}`,
    method: "PUT",
    data: payload,
  });

export const deleteProductById = (id: number) =>
  request<{ ok: true }>({
    url: `/products/${id}`,
    method: "DELETE",
  });

export const deleteProductByExternalId = (externalId: string) =>
  request<{ ok: true }>({
    url: `/products/external/${encodeURIComponent(externalId)}`,
    method: "DELETE",
  });

export const updateProduct = (product: Product, payload: ProductPayload) => {
  if (product.externalId) {
    return updateProductByExternalId(product.externalId, payload);
  }
  const numericId = toNumericId(product.id);
  if (!numericId) {
    throw new Error("No se pudo actualizar: ID de producto invalido.");
  }
  return updateProductById(numericId, payload);
};

export const deleteProduct = (product: Product) => {
  if (product.externalId) {
    return deleteProductByExternalId(product.externalId);
  }
  const numericId = toNumericId(product.id);
  if (!numericId) {
    throw new Error("No se pudo eliminar: ID de producto invalido.");
  }
  return deleteProductById(numericId);
};

