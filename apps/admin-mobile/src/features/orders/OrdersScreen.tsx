import { useCallback, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { listOrders, setOrderStatus } from "../../api/modules/orders";
import { listProducts, updateProduct } from "../../api/modules/products";
import { createSale } from "../../api/modules/sales";
import {
  ORDER_STATUSES,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductPayload,
} from "../../types/domain";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionCard } from "../../components/SectionCard";
import { ActionButton } from "../../components/ActionButton";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { KpiCard } from "../../components/KpiCard";
import { FormField } from "../../components/FormField";
import { formatCurrencyCOP, formatDateTime } from "../../lib/format";
import { theme } from "../../constants/theme";
import { useSyncStore } from "../../store/sync-store";
import {
  decreaseStock,
  increaseStock,
  normalizePresentation,
  SalePresentation,
  validateStockForSaleItem,
} from "../../lib/stock";
import {
  getOrderLedgerEntry,
  getOrderLedgerMap,
  markOrderLedgerCanceled,
  OrderLedgerEntry,
  saveOrderLedgerEntry,
} from "../../lib/order-ledger-storage";
import { exportCsvFile } from "../../lib/csv-export";
import {
  isSameLocalDay,
  isWithinDateRangeInput,
  isWithinLastNDays,
  parseRecordDate,
  sanitizeDateInput,
} from "../../lib/date-filters";

type FilterValue = "all" | OrderStatus;
type OrderDatePreset = "all" | "today" | "last7" | "range";
type ItemSelectionMap = Record<string, Record<string, boolean>>;

const statusToneMap: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  pendiente: "warning",
  aceptado: "success",
  rechazado: "danger",
  cancelado: "neutral",
};

const filterButtons: Array<{ label: string; value: FilterValue }> = [
  { label: "Todos", value: "all" },
  { label: "Pendiente", value: "pendiente" },
  { label: "Aceptado", value: "aceptado" },
  { label: "Rechazado", value: "rechazado" },
  { label: "Cancelado", value: "cancelado" },
];

const dateFilterButtons: Array<{ label: string; value: OrderDatePreset }> = [
  { label: "Todo", value: "all" },
  { label: "Hoy", value: "today" },
  { label: "7 dias", value: "last7" },
  { label: "Rango", value: "range" },
];

const getOrderKey = (order: Order) => String(order.externalId || order.id);
const getOrderItemKey = (item: OrderItem, index: number) =>
  `${String(item.id || `item-${index}`)}|${String(item.presentacion || "").toLowerCase()}|${index}`;

const productIdentity = (product: Product) => String(product.externalId || product.id);

interface OrderWhatsappUpdate {
  estado: "aceptado" | "rechazado" | "cancelado" | "pendiente";
  esParcial?: boolean;
  acceptedItems?: OrderItem[];
  rejectedItems?: OrderItem[];
  totalAccepted?: number;
}

const normalizeWhatsPhone = (phoneRaw: string) => {
  let digits = String(phoneRaw || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  digits = digits.replace(/^0+/, "");
  if (digits.startsWith("57") && digits.length === 13 && digits[2] === "0") {
    digits = `57${digits.slice(3)}`;
  }
  if (digits.length === 10) {
    digits = `57${digits}`;
  }
  if (digits.length < 10) {
    return "";
  }
  return digits;
};

const capitalize = (value: string) => {
  const normalized = String(value || "").toLowerCase();
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : "";
};

const buildClientOrderUpdateMessage = (order: Order, update: OrderWhatsappUpdate) => {
  const estado = String(update.estado || "pendiente").toLowerCase();
  const lines: string[] = [];
  lines.push(`Actualizacion de tu pedido ${order.id}`);
  lines.push(`Estado: ${estado.toUpperCase()}${update.esParcial ? " (PARCIAL)" : ""}`);
  lines.push(`Fecha: ${formatDateTime(new Date().toISOString())}`);
  lines.push("");
  if (order.clienteNombre) {
    lines.push(`Cliente: ${order.clienteNombre}`);
  }
  if (order.clienteTelefono) {
    lines.push(`Tel: ${order.clienteTelefono}`);
  }
  if (order.clienteDireccion) {
    lines.push(`Dir: ${order.clienteDireccion}`);
  }
  lines.push("");

  if (estado === "aceptado") {
    const accepted = update.acceptedItems || [];
    const rejected = update.rejectedItems || [];
    const total =
      Number(update.totalAccepted) > 0 ? Number(update.totalAccepted) : Number(order.total) || 0;

    if (update.esParcial && (accepted.length || rejected.length)) {
      lines.push("Pedido aceptado PARCIALMENTE");
      lines.push("");
      if (accepted.length) {
        lines.push("Disponibles ahora:");
        accepted.forEach((item, index) => {
          lines.push(
            `${index + 1}. ${item.nombre} (${capitalize(item.presentacion)}) x${
              item.cantidad
            } = ${formatCurrencyCOP(item.subtotal)}`
          );
        });
        lines.push("");
      }
      if (rejected.length) {
        lines.push("No disponibles por ahora:");
        rejected.forEach((item, index) => {
          lines.push(
            `${index + 1}. ${item.nombre} (${capitalize(item.presentacion)}) x${item.cantidad}`
          );
        });
        lines.push("");
      }
      lines.push(`Total actualizado: ${formatCurrencyCOP(total)}`);
      lines.push("");
      lines.push("Responde SI para aceptar el pedido parcial.");
      lines.push("Responde NO para cancelar el pedido.");
      return lines.join("\n");
    }

    const items = accepted.length ? accepted : order.items || [];
    lines.push("Pedido aceptado");
    lines.push("Productos:");
    items.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.nombre} (${capitalize(item.presentacion)}) x${item.cantidad} = ${formatCurrencyCOP(
          item.subtotal
        )}`
      );
    });
    lines.push("");
    lines.push(`Total: ${formatCurrencyCOP(total)}`);
    lines.push("Gracias por tu compra.");
    return lines.join("\n");
  }

  if (estado === "rechazado") {
    lines.push("Tu pedido fue rechazado.");
    lines.push("Si deseas, puedes crear un nuevo pedido o escribirnos.");
    return lines.join("\n");
  }

  if (estado === "cancelado") {
    lines.push("Tu pedido fue cancelado.");
    lines.push("Si fue un error, escribenos para ayudarte.");
    return lines.join("\n");
  }

  lines.push("Tu pedido esta en revision.");
  return lines.join("\n");
};

const toWhatsappEstado = (status: string): OrderWhatsappUpdate["estado"] => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "aceptado" || normalized === "rechazado" || normalized === "cancelado") {
    return normalized;
  }
  return "pendiente";
};

const buildProductLookup = (products: Product[]) => {
  const lookup = new Map<string, Product>();
  products.forEach((product) => {
    const id = String(product.id || "").trim();
    const externalId = String(product.externalId || "").trim();
    if (id) {
      lookup.set(id, product);
      const numericId = Number(id);
      if (Number.isFinite(numericId) && numericId > 0) {
        lookup.set(String(numericId), product);
      }
    }
    if (externalId) {
      lookup.set(externalId, product);
    }
  });
  return lookup;
};

const resolveProductFromOrderItem = (
  lookup: Map<string, Product>,
  item: OrderItem
) => {
  const rawId = String(item.id || "").trim();
  if (!rawId) {
    return null;
  }
  return lookup.get(rawId) || null;
};

const productToPayload = (product: Product): ProductPayload => ({
  nombre: product.nombre || "",
  descripcion: product.descripcion || "",
  categoria: product.categoria || "",
  disponibilidad: product.disponibilidad || "Disponible",
  imagen: product.imagen || "",
  precioCaja: Number(product.precioCaja) || 0,
  precioSobre: Number(product.precioSobre) || 0,
  precioUnidad: Number(product.precioUnidad) || 0,
  sobresXCaja: Number(product.sobresXCaja) || 0,
  unidadesXSobre: Number(product.unidadesXSobre) || 0,
  stockCajas: Number(product.stockCajas) || 0,
  ofertaActiva: !!product.ofertaActiva,
  ofertaTexto: product.ofertaTexto || "",
  ofertaPrecioCaja: Number(product.ofertaPrecioCaja) || 0,
  ofertaPrecioSobre: Number(product.ofertaPrecioSobre) || 0,
});

const cloneProduct = (product: Product): Product => ({ ...product });

const initializeSelectionMap = (
  current: ItemSelectionMap,
  orders: Order[]
): ItemSelectionMap => {
  const next: ItemSelectionMap = { ...current };
  orders.forEach((order) => {
    if (String(order.estado).toLowerCase() !== "pendiente") {
      return;
    }
    const orderKey = getOrderKey(order);
    const existing = next[orderKey] || {};
    const filled: Record<string, boolean> = { ...existing };
    (order.items || []).forEach((item, index) => {
      const key = getOrderItemKey(item, index);
      if (filled[key] === undefined) {
        filled[key] = true;
      }
    });
    next[orderKey] = filled;
  });
  return next;
};

export const OrdersScreen = () => {
  const syncTick = useSyncStore((state) => state.syncTick);
  const triggerSync = useSyncStore((state) => state.triggerSync);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingStatusById, setPendingStatusById] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<FilterValue>("all");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [datePreset, setDatePreset] = useState<OrderDatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedItemsByOrder, setSelectedItemsByOrder] = useState<ItemSelectionMap>({});
  const [ledgerByOrder, setLedgerByOrder] = useState<Record<string, OrderLedgerEntry>>({});
  const [activeCriticalAction, setActiveCriticalAction] = useState<"accept" | "reject" | "cancel" | null>(
    null
  );
  const [activeOrderLabel, setActiveOrderLabel] = useState<string | null>(null);

  const loadOrdersData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOrders(filter);
      setOrders(data);
      setSelectedItemsByOrder((current) => initializeSelectionMap(current, data));
      const savedLedger = await getOrderLedgerMap();
      const scopedLedger: Record<string, OrderLedgerEntry> = {};
      data.forEach((order) => {
        const key = getOrderKey(order);
        if (savedLedger[key]) {
          scopedLedger[key] = savedLedger[key];
        }
      });
      setLedgerByOrder(scopedLedger);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible cargar pedidos.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadOrdersData();
  }, [loadOrdersData, syncTick]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      ),
    [orders]
  );

  const dateFilteredOrders = useMemo(() => {
    const now = new Date();
    return sortedOrders.filter((order) => {
      if (datePreset === "all") {
        return true;
      }
      const orderDate = parseRecordDate(order.createdAt);
      if (!orderDate) {
        return false;
      }
      if (datePreset === "today") {
        return isSameLocalDay(orderDate, now);
      }
      if (datePreset === "last7") {
        return isWithinLastNDays(orderDate, 7, now);
      }
      return isWithinDateRangeInput(orderDate, dateFrom, dateTo);
    });
  }, [sortedOrders, datePreset, dateFrom, dateTo]);

  const filteredOrders = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return dateFilteredOrders;
    }
    return dateFilteredOrders.filter((order) =>
      [
        order.id,
        order.externalId,
        order.clienteNombre,
        order.clienteTelefono,
        order.clienteDireccion,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [dateFilteredOrders, query]);

  const hasSearchQuery = query.trim().length > 0;
  const hasDateRangeInput =
    datePreset === "range" && (dateFrom.trim().length > 0 || dateTo.trim().length > 0);
  const hasActiveFilters = hasSearchQuery || datePreset !== "all" || hasDateRangeInput;

  const orderStats = useMemo(() => {
    const pending = dateFilteredOrders.filter((order) => String(order.estado).toLowerCase() === "pendiente").length;
    const accepted = dateFilteredOrders.filter((order) => String(order.estado).toLowerCase() === "aceptado").length;
    const rejected = dateFilteredOrders.filter((order) => String(order.estado).toLowerCase() === "rechazado").length;
    const canceled = dateFilteredOrders.filter((order) => String(order.estado).toLowerCase() === "cancelado").length;
    return {
      total: dateFilteredOrders.length,
      pending,
      accepted,
      rejected,
      canceled,
    };
  }, [dateFilteredOrders]);

  const setRowPending = (order: Order, pending: boolean) => {
    const key = getOrderKey(order);
    setPendingStatusById((prev) => ({ ...prev, [key]: pending }));
  };

  const getAcceptedAndRejected = (order: Order) => {
    const selection = selectedItemsByOrder[getOrderKey(order)] || {};
    const accepted: OrderItem[] = [];
    const rejected: OrderItem[] = [];
    (order.items || []).forEach((item, index) => {
      const key = getOrderItemKey(item, index);
      if (selection[key]) {
        accepted.push(item);
      } else {
        rejected.push(item);
      }
    });
    return { accepted, rejected };
  };

  const applyProductUpdatesWithRollback = async (
    updatedProducts: Product[],
    originalsByIdentity: Map<string, Product>
  ) => {
    const applied: Product[] = [];
    try {
      for (const product of updatedProducts) {
        await updateProduct(product, productToPayload(product));
        applied.push(product);
      }
    } catch (error) {
      for (const appliedProduct of applied.reverse()) {
        const id = productIdentity(appliedProduct);
        const original = originalsByIdentity.get(id);
        if (!original) {
          continue;
        }
        try {
          await updateProduct(original, productToPayload(original));
        } catch {
          // rollback best effort
        }
      }
      throw error;
    }
  };

  const sendOrderUpdateToClientWhatsApp = async (
    order: Order,
    update: OrderWhatsappUpdate
  ) => {
    const tel = normalizeWhatsPhone(order.clienteTelefono || "");
    if (!tel) {
      return;
    }
    const message = buildClientOrderUpdateMessage(order, update);
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("WhatsApp", "No se pudo abrir WhatsApp del cliente.");
    }
  };

  const getManualWhatsappUpdate = (order: Order): OrderWhatsappUpdate => {
    const estado = toWhatsappEstado(String(order.estado || "pendiente"));
    const ledger = ledgerByOrder[getOrderKey(order)];
    if (estado === "aceptado") {
      const acceptedItems =
        ledger?.acceptedItems && ledger.acceptedItems.length
          ? ledger.acceptedItems
          : order.items || [];
      const rejectedItems = ledger?.rejectedItems || [];
      return {
        estado,
        esParcial: rejectedItems.length > 0,
        acceptedItems,
        rejectedItems,
        totalAccepted: Number(ledger?.totalAccepted) || Number(order.total) || 0,
      };
    }
    if (estado === "cancelado") {
      return {
        estado,
        acceptedItems: ledger?.acceptedItems || [],
        rejectedItems: ledger?.rejectedItems || [],
        totalAccepted: Number(ledger?.totalAccepted) || 0,
      };
    }
    return { estado };
  };

  const onManualWhatsapp = (order: Order) => {
    const tel = normalizeWhatsPhone(order.clienteTelefono || "");
    if (!tel) {
      Alert.alert("WhatsApp", "Este pedido no tiene telefono valido del cliente.");
      return;
    }
    void sendOrderUpdateToClientWhatsApp(order, getManualWhatsappUpdate(order));
  };

  const restoreProductsStrict = async (
    productsToRestore: Product[],
    fallbackErrorMessage: string
  ) => {
    const errors: string[] = [];
    for (const product of productsToRestore) {
      try {
        await updateProduct(product, productToPayload(product));
      } catch (error) {
        const message = error instanceof Error ? error.message : "error desconocido";
        errors.push(`${product.nombre || product.id}: ${message}`);
      }
    }
    if (errors.length) {
      throw new Error(
        `${fallbackErrorMessage} Tambien fallo la restauracion de stock: ${errors.join(" | ")}`
      );
    }
  };

  const handleAcceptOrder = async (order: Order) => {
    if (String(order.estado).toLowerCase() !== "pendiente") {
      Alert.alert("Pedido no valido", "Solo se pueden aceptar pedidos pendientes.");
      return;
    }

    const { accepted, rejected } = getAcceptedAndRejected(order);
    if (!accepted.length) {
      Alert.alert("Accion bloqueada", "Debes aceptar al menos un item.");
      return;
    }

    const remoteProducts = await listProducts();
    const productLookup = buildProductLookup(remoteProducts);
    const originals = new Map<string, Product>();
    const touched = new Map<string, Product>();
    const stockErrors: string[] = [];

    accepted.forEach((item) => {
      const itemProductId = String(item.id || "");
      const product = resolveProductFromOrderItem(productLookup, item);
      if (!product) {
        stockErrors.push(`${item.nombre}: producto no encontrado.`);
        return;
      }
      const presentation = normalizePresentation(item.presentacion) as SalePresentation;
      const validation = validateStockForSaleItem(product, presentation, Number(item.cantidad) || 0);
      if (!validation.ok) {
        stockErrors.push(`${item.nombre} (${presentation}): ${validation.message}`);
        return;
      }
      const currentTouched = touched.get(itemProductId) || cloneProduct(product);
      if (!originals.has(itemProductId)) {
        originals.set(itemProductId, cloneProduct(product));
      }
      const decreaseResult = decreaseStock(currentTouched, presentation, Number(item.cantidad) || 0);
      if (!decreaseResult.ok) {
        stockErrors.push(`${item.nombre} (${presentation}): ${decreaseResult.message}`);
        return;
      }
      touched.set(itemProductId, currentTouched);
    });

    if (stockErrors.length) {
      Alert.alert("Stock insuficiente", stockErrors.join("\n"));
      return;
    }

    const updatedProducts = Array.from(touched.values());
    await applyProductUpdatesWithRollback(updatedProducts, originals);

    const totalAccepted = accepted.reduce(
      (sum, item) => sum + (Number(item.subtotal) || (Number(item.precioUnit) || 0) * (Number(item.cantidad) || 0)),
      0
    );

    const processedAtISO = new Date().toISOString();
    try {
      await saveOrderLedgerEntry({
        orderKey: getOrderKey(order),
        acceptedItems: accepted,
        rejectedItems: rejected,
        totalAccepted,
        processedAtISO,
      });
    } catch (error) {
      await restoreProductsStrict(
        Array.from(originals.values()),
        "No se pudo guardar la trazabilidad local del pedido."
      );
      throw error;
    }

    try {
      await setOrderStatus(order, "aceptado");
    } catch (error) {
      await restoreProductsStrict(
        Array.from(originals.values()),
        "No se pudo confirmar el estado del pedido."
      );
      throw error;
    }

    try {
      await createSale({
        refId: String(order.id || ""),
        clienteNombre: order.clienteNombre || "",
        clienteTelefono: order.clienteTelefono || "",
        total: totalAccepted,
        items: accepted.map((item) => ({
          id: String(item.id || ""),
          nombre: item.nombre || "",
          presentacion: item.presentacion || "",
          precioUnit: Number(item.precioUnit) || 0,
          cantidad: Number(item.cantidad) || 0,
          subtotal:
            Number(item.subtotal) ||
            (Number(item.precioUnit) || 0) * (Number(item.cantidad) || 0),
        })),
        metodoPago: "",
        fechaISO: processedAtISO,
      });
    } catch {
      Alert.alert(
        "Venta pendiente",
        "Pedido aceptado y stock actualizado, pero no se pudo registrar la venta automaticamente."
      );
    }

    void sendOrderUpdateToClientWhatsApp(order, {
      estado: "aceptado",
      esParcial: rejected.length > 0,
      acceptedItems: accepted,
      rejectedItems: rejected,
      totalAccepted,
    });
  };

  const handleRejectOrder = async (order: Order) => {
    if (String(order.estado).toLowerCase() !== "pendiente") {
      Alert.alert("Pedido no valido", "Solo se pueden rechazar pedidos pendientes.");
      return;
    }
    await setOrderStatus(order, "rechazado");
    void sendOrderUpdateToClientWhatsApp(order, { estado: "rechazado" });
  };

  const handleCancelOrder = async (order: Order) => {
    if (String(order.estado).toLowerCase() !== "aceptado") {
      Alert.alert("Pedido no valido", "Solo se pueden cancelar pedidos aceptados.");
      return;
    }

    const ledger = await getOrderLedgerEntry(getOrderKey(order));
    if (!ledger || !ledger.acceptedItems.length) {
      Alert.alert(
        "Cancelacion bloqueada",
        "No existe trazabilidad local de items aceptados. Para proteger stock no se cancela este pedido."
      );
      return;
    }

    const remoteProducts = await listProducts();
    const productLookup = buildProductLookup(remoteProducts);
    const touched = new Map<string, Product>();
    const originals = new Map<string, Product>();
    const errors: string[] = [];

    ledger.acceptedItems.forEach((item) => {
      const itemProductId = String(item.id || "");
      const product = resolveProductFromOrderItem(productLookup, item);
      if (!product) {
        errors.push(`${item.nombre}: producto no encontrado para revertir.`);
        return;
      }
      const presentation = normalizePresentation(item.presentacion) as SalePresentation;
      const currentTouched = touched.get(itemProductId) || cloneProduct(product);
      if (!originals.has(itemProductId)) {
        originals.set(itemProductId, cloneProduct(product));
      }
      const result = increaseStock(currentTouched, presentation, Number(item.cantidad) || 0);
      if (!result.ok) {
        errors.push(`${item.nombre} (${presentation}): ${result.message}`);
        return;
      }
      touched.set(itemProductId, currentTouched);
    });

    if (errors.length) {
      Alert.alert("No se pudo cancelar", errors.join("\n"));
      return;
    }

    await applyProductUpdatesWithRollback(Array.from(touched.values()), originals);
    try {
      await setOrderStatus(order, "cancelado");
    } catch (error) {
      await restoreProductsStrict(
        Array.from(originals.values()),
        "No se pudo confirmar la cancelacion del pedido."
      );
      throw error;
    }

    try {
      await markOrderLedgerCanceled(getOrderKey(order));
    } catch {
      Alert.alert(
        "Cancelacion parcial",
        "Pedido cancelado y stock revertido, pero no se pudo actualizar la trazabilidad local."
      );
    }

    void sendOrderUpdateToClientWhatsApp(order, {
      estado: "cancelado",
      acceptedItems: ledger.acceptedItems || [],
      rejectedItems: ledger.rejectedItems || [],
      totalAccepted: Number(ledger.totalAccepted) || 0,
    });
  };

  const runOrderAction = (order: Order, action: "accept" | "reject" | "cancel") => {
    if (pendingStatusById[getOrderKey(order)]) {
      return;
    }
    if (activeCriticalAction) {
      Alert.alert(
        "Operacion en curso",
        "Ya hay una accion critica ejecutandose. Espera a que termine."
      );
      return;
    }
    const label =
      action === "accept"
        ? "Aceptar"
        : action === "reject"
        ? "Rechazar"
        : "Cancelar";
    const actionNote =
      action === "accept"
        ? "Esto descuenta stock, actualiza estado, registra venta y puede abrir WhatsApp."
        : action === "reject"
        ? "Esto cambia el pedido a rechazado y notifica al cliente por WhatsApp."
        : "Esto revierte stock del pedido aceptado, cambia estado y notifica al cliente.";
    const orderLabel = String(order.id || "--");
    Alert.alert("Confirmar accion critica", `${label} pedido ${orderLabel}?\n\n${actionNote}`, [
      { text: "No", style: "cancel" },
      {
        text: "Si",
        style: action === "reject" || action === "cancel" ? "destructive" : "default",
        onPress: async () => {
          setActiveCriticalAction(action);
          setActiveOrderLabel(orderLabel);
          setRowPending(order, true);
          try {
            if (action === "accept") {
              await handleAcceptOrder(order);
            } else if (action === "reject") {
              await handleRejectOrder(order);
            } else {
              await handleCancelOrder(order);
            }
            await loadOrdersData();
            triggerSync();
          } catch (e) {
            const message = e instanceof Error ? e.message : "No fue posible completar la accion.";
            Alert.alert("Error", message);
          } finally {
            setRowPending(order, false);
            setActiveCriticalAction(null);
            setActiveOrderLabel(null);
          }
        },
      },
    ]);
  };

  const toggleItemSelection = (order: Order, item: OrderItem, index: number) => {
    const orderKey = getOrderKey(order);
    const itemKey = getOrderItemKey(item, index);
    setSelectedItemsByOrder((prev) => {
      const current = prev[orderKey] || {};
      return {
        ...prev,
        [orderKey]: {
          ...current,
          [itemKey]: !current[itemKey],
        },
      };
    });
  };

  const setAllItemsSelection = (order: Order, selected: boolean) => {
    const orderKey = getOrderKey(order);
    const nextSelection: Record<string, boolean> = {};
    (order.items || []).forEach((item, index) => {
      nextSelection[getOrderItemKey(item, index)] = selected;
    });
    setSelectedItemsByOrder((prev) => ({
      ...prev,
      [orderKey]: nextSelection,
    }));
  };

  const onChangeFilter = (nextFilter: FilterValue) => {
    setFilter(nextFilter);
  };

  const clearFilters = () => {
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
    setQuery("");
  };

  const onExportOrders = async () => {
    const rows: Array<Array<unknown>> = [
      [
        "id",
        "externalId",
        "estado",
        "createdAt",
        "clienteNombre",
        "clienteTelefono",
        "clienteDireccion",
        "total",
        "items_json",
        "accepted_preview_json",
        "rejected_preview_json",
      ],
      ...filteredOrders.map((order) => {
        const status = String(order.estado || "").toLowerCase();
        const ledger = ledgerByOrder[getOrderKey(order)];
        const { accepted, rejected } =
          status === "pendiente"
            ? getAcceptedAndRejected(order)
            : {
                accepted: ledger?.acceptedItems || ([] as OrderItem[]),
                rejected: ledger?.rejectedItems || ([] as OrderItem[]),
              };
        return [
          order.id,
          order.externalId || "",
          order.estado,
          order.createdAt || "",
          order.clienteNombre,
          order.clienteTelefono,
          order.clienteDireccion,
          order.total,
          JSON.stringify(order.items || []),
          JSON.stringify(accepted),
          JSON.stringify(rejected),
        ];
      }),
    ];

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await exportCsvFile(`pedidos_renacer_${stamp}.csv`, rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible exportar pedidos.";
      Alert.alert("Error", message);
    }
  };

  return (
    <ScreenContainer>
      <SectionCard title="Pedidos">
        <Text style={styles.subtle}>
          Flujo critico: aceptacion parcial por item, ajuste de stock y registro de venta.
        </Text>
        {activeCriticalAction ? (
          <View style={styles.processingBanner}>
            <ActivityIndicator size="small" color={theme.colors.primaryStrong} />
            <Text style={styles.processingBannerText}>
              Procesando pedido {activeOrderLabel || "--"}...
            </Text>
          </View>
        ) : null}
        <View style={styles.statsRow}>
          <View style={styles.statsItem}>
            <KpiCard
              label="Total Pedidos"
              value={String(orderStats.total)}
              tone="primary"
              icon="receipt-outline"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Pendientes"
              value={String(orderStats.pending)}
              tone="warning"
              icon="time-outline"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Aceptados"
              value={String(orderStats.accepted)}
              tone="success"
              icon="checkmark-circle-outline"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Rechazados"
              value={String(orderStats.rejected)}
              tone="danger"
              icon="close-circle-outline"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Cancelados"
              value={String(orderStats.canceled)}
              tone="neutral"
              icon="ban-outline"
              compact
            />
          </View>
        </View>
        <View style={styles.filterRow}>
          {filterButtons.map((button) => {
            const active = filter === button.value;
            return (
              <Pressable
                key={button.value}
                disabled={!!activeCriticalAction}
                onPress={() => onChangeFilter(button.value)}
                style={[
                  styles.filterButton,
                  active && styles.filterButtonActive,
                  !!activeCriticalAction && styles.controlDisabled,
                ]}
              >
                <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>
                  {button.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.sectionLabel}>Filtrar por fecha</Text>
        <View style={styles.filterRow}>
          {dateFilterButtons.map((button) => {
            const active = datePreset === button.value;
            return (
              <Pressable
                key={button.value}
                disabled={!!activeCriticalAction}
                onPress={() => setDatePreset(button.value)}
                style={[
                  styles.filterButton,
                  active && styles.filterButtonActive,
                  !!activeCriticalAction && styles.controlDisabled,
                ]}
              >
                <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>
                  {button.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {datePreset === "range" ? (
          <View style={styles.dateRangeRow}>
            <View style={styles.dateRangeField}>
              <FormField
                label="Desde"
                value={dateFrom}
                onChangeText={(value) => setDateFrom(sanitizeDateInput(value))}
                placeholder="2026-02-01"
                editable={!activeCriticalAction}
              />
            </View>
            <View style={styles.dateRangeField}>
              <FormField
                label="Hasta"
                value={dateTo}
                onChangeText={(value) => setDateTo(sanitizeDateInput(value))}
                placeholder="2026-02-28"
                editable={!activeCriticalAction}
              />
            </View>
          </View>
        ) : null}
        <FormField
          label="Buscar pedido"
          value={query}
          onChangeText={setQuery}
          placeholder="Ref, cliente, telefono o direccion"
          editable={!activeCriticalAction}
        />
        <View style={styles.searchSummaryRow}>
          <Text style={styles.subtle}>Mostrando {filteredOrders.length} pedidos</Text>
          {hasActiveFilters ? (
            <Pressable
              style={[styles.clearSearchButton, !!activeCriticalAction && styles.controlDisabled]}
              onPress={clearFilters}
              disabled={!!activeCriticalAction}
            >
              <Text style={styles.clearSearchButtonText}>Limpiar filtros</Text>
            </Pressable>
          ) : null}
        </View>
        <ActionButton
          label="Exportar CSV"
          variant="secondary"
          onPress={() => void onExportOrders()}
          disabled={!!activeCriticalAction}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SectionCard>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.subtle}>Cargando pedidos...</Text>
        </View>
      ) : null}

      {!loading && filteredOrders.length === 0 ? (
        <EmptyState
          title="Sin pedidos"
          subtitle={
            hasActiveFilters
              ? "No hay pedidos para los filtros seleccionados."
              : "No hay pedidos para este filtro."
          }
        />
      ) : null}

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => getOrderKey(item)}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const orderKey = getOrderKey(item);
          const rowLoading = !!pendingStatusById[orderKey];
          const estado = String(item.estado || "").toLowerCase();
          const externalRef = String(item.externalId || item.id || "local");
          const externalRefShort =
            externalRef.length > 22
              ? `${externalRef.slice(0, 12)}...${externalRef.slice(-4)}`
              : externalRef;
          const selection = selectedItemsByOrder[orderKey] || {};
          const ledger = ledgerByOrder[orderKey];
          const acceptedCount = (item.items || []).filter((orderItem, index) => {
            const key = getOrderItemKey(orderItem, index);
            return !!selection[key];
          }).length;
          const totalItems = item.items?.length || 0;
          const acceptedCountFromLedger = ledger?.acceptedItems?.length || 0;
          const rejectedCountFromLedger = ledger?.rejectedItems?.length || 0;
          const isPartialAccepted =
            estado === "aceptado" && !!ledger && rejectedCountFromLedger > 0;
          return (
            <SectionCard>
              <View style={styles.orderHeaderShell}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <View style={styles.orderTitleRow}>
                      <Text style={styles.orderId}>Pedido {item.id}</Text>
                    </View>
                    <Text style={styles.orderMeta}>
                      {item.clienteNombre || "Sin nombre"} - {item.clienteTelefono || "Sin telefono"}
                    </Text>
                    {item.clienteDireccion ? (
                      <Text style={styles.orderMeta}>{item.clienteDireccion}</Text>
                    ) : null}
                    <View style={styles.orderChipsRow}>
                      <View style={[styles.orderChip, styles.orderChipExt]}>
                        <Ionicons
                          name="link-outline"
                          size={13}
                          color={theme.colors.primaryStrong}
                        />
                        <Text
                          style={[styles.orderChipText, styles.orderChipExtText]}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {item.externalId ? `Ext ${externalRefShort}` : "Local"}
                        </Text>
                      </View>
                      <View style={styles.orderChip}>
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color={theme.colors.primaryStrong}
                        />
                        <Text style={styles.orderChipText}>{formatDateTime(item.createdAt)}</Text>
                      </View>
                      <View style={styles.orderChip}>
                        <Ionicons
                          name="list-outline"
                          size={13}
                          color={theme.colors.primaryStrong}
                        />
                        <Text style={styles.orderChipText}>{totalItems} items</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.orderStatus}>
                    <StatusBadge text={estado} tone={statusToneMap[estado] || "neutral"} />
                    {isPartialAccepted ? <StatusBadge text="parcial" tone="warning" /> : null}
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.total}>{formatCurrencyCOP(item.total)}</Text>
                  </View>
                </View>
              </View>

              {estado === "aceptado" && ledger ? (
                <View style={styles.ledgerRow}>
                  <Text style={styles.ledgerText}>
                    Aceptados: {acceptedCountFromLedger}/{item.items.length}
                  </Text>
                  {rejectedCountFromLedger ? (
                    <Text style={styles.ledgerText}>Rechazados: {rejectedCountFromLedger}</Text>
                  ) : null}
                  <Text style={styles.ledgerText}>
                    Total aceptado: {formatCurrencyCOP(ledger.totalAccepted || item.total)}
                  </Text>
                  <Text style={styles.ledgerText}>
                    Procesado: {formatDateTime(ledger.processedAtISO)}
                  </Text>
                </View>
              ) : null}

              {estado === "cancelado" && ledger?.canceledAtISO ? (
                <Text style={styles.ledgerText}>
                  Cancelado y stock revertido: {formatDateTime(ledger.canceledAtISO)}
                </Text>
              ) : null}

              {(item.items || []).length ? (
                <View style={styles.itemsContainer}>
                  {(item.items || []).map((orderItem, index) => {
                    const itemKey = getOrderItemKey(orderItem, index);
                    const selected = selection[itemKey] ?? true;
                    const isPending = estado === "pendiente";
                    return (
                      <Pressable
                        key={itemKey}
                        disabled={!isPending}
                        onPress={() => toggleItemSelection(item, orderItem, index)}
                        style={[
                          styles.itemRow,
                          isPending && selected && styles.itemSelected,
                          isPending && !selected && styles.itemUnselected,
                        ]}
                      >
                        <View style={styles.itemLeft}>
                          <Ionicons
                            name={
                              isPending
                                ? selected
                                  ? "checkmark-circle"
                                  : "close-circle"
                                : "ellipse"
                            }
                            size={16}
                            color={
                              isPending
                                ? selected
                                  ? theme.colors.success
                                  : theme.colors.danger
                                : theme.colors.textMuted
                            }
                          />
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemTitle}>
                              {orderItem.nombre} ({orderItem.presentacion})
                            </Text>
                            <Text style={styles.itemMeta}>
                              {formatCurrencyCOP(orderItem.precioUnit)} x {orderItem.cantidad}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.itemRight}>
                          <Text style={styles.itemSubtotal}>{formatCurrencyCOP(orderItem.subtotal)}</Text>
                          {isPending ? (
                            <Text
                              style={[
                                styles.itemSelectionLabel,
                                selected
                                  ? styles.itemSelectionLabelAccepted
                                  : styles.itemSelectionLabelRejected,
                              ]}
                            >
                              {selected ? "Aceptado" : "Rechazado"}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                  {estado === "pendiente" ? (
                    <>
                      <View style={styles.bulkActionsRow}>
                        <Pressable
                          style={[styles.bulkActionButton, !!activeCriticalAction && styles.controlDisabled]}
                          disabled={!!activeCriticalAction}
                          onPress={() => setAllItemsSelection(item, true)}
                        >
                          <Text style={styles.bulkActionLabel}>Aceptar todo</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.bulkActionButton, !!activeCriticalAction && styles.controlDisabled]}
                          disabled={!!activeCriticalAction}
                          onPress={() => setAllItemsSelection(item, false)}
                        >
                          <Text style={styles.bulkActionLabel}>Rechazar todo</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.pendingHelper}>
                        Items aceptados para procesar: {acceptedCount}/{item.items.length}
                      </Text>
                    </>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                {estado === "pendiente" ? (
                  <>
                    <View style={styles.actionItem}>
                      <ActionButton
                        label="Aceptar"
                        onPress={() => runOrderAction(item, "accept")}
                        loading={rowLoading}
                        disabled={!!activeCriticalAction && !rowLoading}
                      />
                    </View>
                    <View style={styles.actionItem}>
                      <ActionButton
                        label="Rechazar"
                        variant="danger"
                        onPress={() => runOrderAction(item, "reject")}
                        loading={rowLoading}
                        disabled={!!activeCriticalAction && !rowLoading}
                      />
                    </View>
                  </>
                ) : null}

                {estado === "aceptado" ? (
                  <View style={styles.actionItem}>
                    <ActionButton
                      label="Cancelar (revertir stock)"
                      variant="danger"
                      onPress={() => runOrderAction(item, "cancel")}
                      loading={rowLoading}
                      disabled={!!activeCriticalAction && !rowLoading}
                    />
                  </View>
                ) : null}
              </View>
              <Pressable
                style={[
                  styles.whatsappButton,
                  (rowLoading || !!activeCriticalAction) && styles.whatsappButtonDisabled,
                ]}
                onPress={() => onManualWhatsapp(item)}
                disabled={rowLoading || !!activeCriticalAction}
              >
                <Ionicons name="logo-whatsapp" size={16} color={theme.colors.success} />
                <Text style={styles.whatsappButtonLabel}>WhatsApp cliente</Text>
              </Pressable>
            </SectionCard>
          );
        }}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  subtle: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  processingBanner: {
    borderWidth: 1,
    borderColor: "rgba(11,99,208,0.25)",
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(11,99,208,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  processingBannerText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statsItem: {
    flex: 1,
    minWidth: 106,
  },
  sectionLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: theme.colors.surface,
  },
  filterButtonActive: {
    backgroundColor: "rgba(33,128,141,0.15)",
    borderColor: "rgba(33,128,141,0.35)",
  },
  filterButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  filterButtonTextActive: {
    color: theme.colors.primaryStrong,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateRangeRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateRangeField: {
    flex: 1,
  },
  searchSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  clearSearchButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearSearchButtonText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  controlDisabled: {
    opacity: 0.55,
  },
  error: {
    color: "#991b1b",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.25)",
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    padding: 8,
  },
  orderHeaderShell: {
    borderWidth: 1,
    borderColor: "rgba(33,128,141,0.18)",
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(11,99,208,0.03)",
    padding: 8,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  orderInfo: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  orderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderStatus: {
    alignItems: "flex-end",
    gap: 6,
    minWidth: 112,
  },
  orderId: {
    fontSize: 17,
    fontWeight: "900",
    color: theme.colors.text,
    flexShrink: 1,
  },
  orderMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  orderChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  orderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  orderChipExt: {
    backgroundColor: "rgba(33,128,141,0.1)",
    borderColor: "rgba(33,128,141,0.26)",
  },
  orderChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.text,
    maxWidth: 170,
  },
  orderChipExtText: {
    color: theme.colors.primaryStrong,
    fontWeight: "800",
  },
  total: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
  totalLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  ledgerRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    padding: 8,
    gap: 2,
  },
  ledgerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  itemsContainer: {
    gap: 8,
  },
  itemRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: theme.colors.surface,
  },
  itemSelected: {
    borderColor: "rgba(16,185,129,0.35)",
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  itemUnselected: {
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  itemRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  itemTitle: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
  itemMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  itemSubtotal: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12,
  },
  itemSelectionLabel: {
    fontSize: 11,
    fontWeight: "800",
  },
  itemSelectionLabelAccepted: {
    color: theme.colors.success,
  },
  itemSelectionLabelRejected: {
    color: theme.colors.danger,
  },
  pendingHelper: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  bulkActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  bulkActionButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  bulkActionLabel: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionItem: {
    flex: 1,
  },
  whatsappButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.35)",
    backgroundColor: "rgba(16,185,129,0.08)",
    borderRadius: theme.radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  whatsappButtonDisabled: {
    opacity: 0.55,
  },
  whatsappButtonLabel: {
    color: "#166534",
    fontWeight: "800",
    fontSize: 13,
  },
});
