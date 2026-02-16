import { request } from "../client";
import { Sale, SalePayload } from "../../types/domain";

type RawSale = {
  id?: number;
  refId?: string;
  refid?: string;
  userId?: number;
  userid?: number;
  userName?: string;
  username?: string;
  clienteNombre?: string;
  clientenombre?: string;
  clienteTelefono?: string;
  clientetelefono?: string;
  total?: number;
  items?: unknown[];
  metodoPago?: string;
  metodopago?: string;
  fechaISO?: string;
  fechaiso?: string;
  createdAt?: string;
  createdat?: string;
};

const normalizeSale = (raw: RawSale): Sale => ({
  id: Number(raw.id) || undefined,
  refId: raw.refId ?? raw.refid ?? null,
  userId: Number(raw.userId ?? raw.userid) || null,
  userName: raw.userName ?? raw.username ?? "",
  clienteNombre: raw.clienteNombre ?? raw.clientenombre ?? "",
  clienteTelefono: raw.clienteTelefono ?? raw.clientetelefono ?? "",
  total: Number(raw.total) || 0,
  items: Array.isArray(raw.items) ? (raw.items as Sale["items"]) : [],
  metodoPago: raw.metodoPago ?? raw.metodopago ?? "",
  fechaISO: raw.fechaISO ?? raw.fechaiso ?? raw.createdAt ?? raw.createdat,
  createdAt: raw.createdAt ?? raw.createdat,
});

export const listSales = async () => {
  const rows = await request<RawSale[]>({
    url: "/sales",
    method: "GET",
  });
  return rows.map(normalizeSale);
};

export const createSale = (payload: SalePayload) =>
  request<{ id: number; existing?: boolean }>({
    url: "/sales",
    method: "POST",
    data: payload,
  });

export const clearSales = () =>
  request<{ ok: true }>({
    url: "/sales",
    method: "DELETE",
  });

