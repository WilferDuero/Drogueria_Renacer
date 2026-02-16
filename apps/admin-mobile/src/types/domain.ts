export type UserRole = "owner" | "staff";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
}

export interface HealthResponse {
  ok: boolean;
  time: string;
}

export type OrderStatus = "pendiente" | "aceptado" | "rechazado" | "cancelado";

export const ORDER_STATUSES: OrderStatus[] = [
  "pendiente",
  "aceptado",
  "rechazado",
  "cancelado",
];

export interface Product {
  id: number | string;
  externalId?: string | null;
  nombre: string;
  descripcion: string;
  categoria: string;
  disponibilidad: string;
  imagen: string;
  precioCaja: number;
  precioSobre: number;
  precioUnidad: number;
  sobresXCaja: number;
  unidadesXSobre: number;
  stockCajas: number;
  ofertaActiva: boolean;
  ofertaTexto: string;
  ofertaPrecioCaja: number;
  ofertaPrecioSobre: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductPayload {
  externalId?: string | null;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  disponibilidad?: string;
  imagen?: string;
  precioCaja?: number;
  precioSobre?: number;
  precioUnidad?: number;
  sobresXCaja?: number;
  unidadesXSobre?: number;
  stockCajas?: number;
  ofertaActiva?: boolean;
  ofertaTexto?: string;
  ofertaPrecioCaja?: number;
  ofertaPrecioSobre?: number;
}

export interface OrderItem {
  id: string;
  nombre: string;
  presentacion: string;
  precioUnit: number;
  cantidad: number;
  subtotal: number;
}

export interface Order {
  id: string;
  numericId?: number;
  externalId?: string | null;
  clienteNombre: string;
  clienteTelefono: string;
  clienteDireccion: string;
  items: OrderItem[];
  total: number;
  estado: string;
  createdAt?: string;
}

export interface SaleItem {
  id?: string;
  nombre: string;
  presentacion: string;
  precioUnit: number;
  cantidad: number;
  subtotal: number;
}

export interface Sale {
  id?: number;
  refId?: string | null;
  userId?: number | null;
  userName?: string;
  clienteNombre: string;
  clienteTelefono: string;
  total: number;
  items: SaleItem[];
  metodoPago: string;
  fechaISO?: string;
  createdAt?: string;
}

export interface SalePayload {
  refId?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  total: number;
  items: SaleItem[];
  metodoPago?: string;
  fechaISO?: string;
}

export interface UserSummary {
  id: number;
  username: string;
  role: UserRole;
  createdAt?: string;
}

export interface UserCreatePayload {
  username: string;
  password: string;
  role: UserRole;
}

export interface UserUpdatePayload {
  username?: string;
  password?: string;
  role?: UserRole;
}

export interface Review {
  id: number;
  nombre: string;
  telefono: string;
  rating: number;
  texto: string;
  verificada: boolean | number;
  createdAt?: string;
}

