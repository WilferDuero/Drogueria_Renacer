import { request } from "../client";
import { ORDER_STATUSES, Order, OrderStatus } from "../../types/domain";

type RawOrder = {
  id?: number;
  externalId?: string | null;
  externalid?: string | null;
  clienteNombre?: string;
  clientenombre?: string;
  clienteTelefono?: string;
  clientetelefono?: string;
  clienteDireccion?: string;
  clientedireccion?: string;
  items?: unknown[];
  total?: number;
  estado?: string;
  createdAt?: string;
  createdat?: string;
};

const normalizeOrderItem = (raw: unknown, index: number): Order["items"][number] => {
  const item = (raw || {}) as Record<string, unknown>;
  const cantidad = Number(item.cantidad) || 0;
  const precioUnit = Number(item.precioUnit) || 0;
  const subtotalRaw = Number(item.subtotal);
  return {
    id: String(item.id || `item-${index}`),
    nombre: String(item.nombre || "Producto"),
    presentacion: String(item.presentacion || "caja").toLowerCase(),
    precioUnit,
    cantidad,
    subtotal: Number.isFinite(subtotalRaw) ? subtotalRaw : precioUnit * cantidad,
  };
};

const normalizeOrder = (raw: RawOrder): Order => {
  const externalId = raw.externalId ?? raw.externalid ?? null;
  const numericId = Number(raw.id || 0);
  const items = Array.isArray(raw.items)
    ? raw.items.map((item, idx) => normalizeOrderItem(item, idx))
    : [];
  return {
    id: externalId || String(raw.id || ""),
    numericId: Number.isFinite(numericId) && numericId > 0 ? numericId : undefined,
    externalId,
    clienteNombre: raw.clienteNombre ?? raw.clientenombre ?? "",
    clienteTelefono: raw.clienteTelefono ?? raw.clientetelefono ?? "",
    clienteDireccion: raw.clienteDireccion ?? raw.clientedireccion ?? "",
    items,
    total: Number(raw.total) || 0,
    estado: String(raw.estado || "pendiente").toLowerCase(),
    createdAt: raw.createdAt ?? raw.createdat,
  };
};

const assertOrderStatus = (status: string): OrderStatus => {
  if (ORDER_STATUSES.includes(status as OrderStatus)) {
    return status as OrderStatus;
  }
  throw new Error(`Estado invalido: ${status}`);
};

export const listOrders = async (status?: OrderStatus | "all") => {
  const params = status && status !== "all" ? { estado: status } : undefined;
  const rows = await request<RawOrder[]>({
    url: "/orders",
    method: "GET",
    params,
  });
  return rows.map(normalizeOrder);
};

export const updateOrderStatusById = (id: number, status: OrderStatus) =>
  request<{ ok: true }>({
    url: `/orders/${id}/status`,
    method: "PUT",
    data: { estado: status },
  });

export const updateOrderStatusByExternalId = (externalId: string, status: OrderStatus) =>
  request<{ ok: true }>({
    url: `/orders/external/${encodeURIComponent(externalId)}/status`,
    method: "PUT",
    data: { estado: status },
  });

export const setOrderStatus = (order: Order, nextStatus: string) => {
  const status = assertOrderStatus(String(nextStatus).toLowerCase());
  if (order.externalId) {
    return updateOrderStatusByExternalId(order.externalId, status);
  }
  if (order.numericId) {
    return updateOrderStatusById(order.numericId, status);
  }
  throw new Error("No se pudo actualizar el pedido: faltan identificadores.");
};
