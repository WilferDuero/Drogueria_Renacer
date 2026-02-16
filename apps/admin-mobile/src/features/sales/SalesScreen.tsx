import { useCallback, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { listProducts } from "../../api/modules/products";
import { clearSales, createSale, listSales } from "../../api/modules/sales";
import { Product, SaleItem, UserRole } from "../../types/domain";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionCard } from "../../components/SectionCard";
import { FormField } from "../../components/FormField";
import { ActionButton } from "../../components/ActionButton";
import { EmptyState } from "../../components/EmptyState";
import { KpiCard } from "../../components/KpiCard";
import { formatCurrencyCOP, formatDateTime, toInteger, toNumber } from "../../lib/format";
import { theme } from "../../constants/theme";
import { useSyncStore } from "../../store/sync-store";
import { useAuthStore } from "../../store/auth-store";
import { exportCsvFile } from "../../lib/csv-export";
import { computeSalesRevenueSummary } from "../../lib/sales-metrics";
import {
  isInCurrentLocalMonth,
  isSameLocalDay,
  isWithinDateRangeInput,
  parseRecordDate,
  sanitizeDateInput,
} from "../../lib/date-filters";

type SalesDatePreset = "all" | "today" | "month" | "range";

const salesDateFilterButtons: Array<{ label: string; value: SalesDatePreset }> = [
  { label: "Todo", value: "all" },
  { label: "Hoy", value: "today" },
  { label: "Mes", value: "month" },
  { label: "Rango", value: "range" },
];

const revenueCards: Array<{
  key: "today" | "month" | "year";
  label: string;
  helper: string;
  icon: "today-outline" | "calendar-outline" | "trending-up-outline";
}> = [
  {
    key: "today",
    label: "Ingresos Hoy",
    helper: "Ventas del dia en curso",
    icon: "today-outline",
  },
  {
    key: "month",
    label: "Ingresos Mes",
    helper: "Acumulado del mes actual",
    icon: "calendar-outline",
  },
  {
    key: "year",
    label: "Ingresos Ano",
    helper: "Acumulado del ano actual",
    icon: "trending-up-outline",
  },
];

interface SaleFormState {
  refId: string;
  clienteNombre: string;
  clienteTelefono: string;
  total: string;
  metodoPago: string;
  itemsJson: string;
}

type SalePresentation = "caja" | "sobre" | "unidad";

interface SaleDraftState {
  productKey: string;
  presentacion: SalePresentation;
  cantidad: string;
}

const initialForm: SaleFormState = {
  refId: "",
  clienteNombre: "",
  clienteTelefono: "",
  total: "",
  metodoPago: "",
  itemsJson: "",
};

const initialSaleDraft: SaleDraftState = {
  productKey: "",
  presentacion: "caja",
  cantidad: "1",
};

const saleItemsTemplate =
  '[{"nombre":"Producto","presentacion":"caja","precioUnit":1000,"cantidad":1,"subtotal":1000}]';
const saleItemsPlaceholder = "Opcional (avanzado): detalle de items en formato JSON";

const salePresentationButtons: Array<{ label: string; value: SalePresentation }> = [
  { label: "Caja", value: "caja" },
  { label: "Sobre", value: "sobre" },
  { label: "Unidad", value: "unidad" },
];

const getProductKey = (product: Product) => String(product.externalId || product.id);

const getPresentationPrice = (product: Product, presentation: SalePresentation) => {
  if (presentation === "caja") {
    return Number(product.precioCaja) || 0;
  }
  if (presentation === "sobre") {
    return Number(product.precioSobre) || 0;
  }
  return Number(product.precioUnidad) || 0;
};

const normalizeItemsFromText = (itemsJson: string): SaleItem[] => {
  if (!itemsJson.trim()) {
    return [];
  }
  const parsed = JSON.parse(itemsJson);
  if (!Array.isArray(parsed)) {
    throw new Error("itemsJson debe ser un arreglo.");
  }

  return parsed.map((item) => ({
    id: item?.id ? String(item.id) : undefined,
    nombre: String(item?.nombre || ""),
    presentacion: String(item?.presentacion || ""),
    precioUnit: Number(item?.precioUnit) || 0,
    cantidad: Number(item?.cantidad) || 0,
    subtotal: Number(item?.subtotal) || 0,
  }));
};

export const SalesScreen = () => {
  const role = useAuthStore((state) => (state.user?.role || "staff") as UserRole);
  const syncTick = useSyncStore((state) => state.syncTick);
  const [form, setForm] = useState<SaleFormState>(initialForm);
  const [draft, setDraft] = useState<SaleDraftState>(initialSaleDraft);
  const [productsCatalog, setProductsCatalog] = useState<Product[]>([]);
  const [assistedItems, setAssistedItems] = useState<SaleItem[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [sales, setSales] = useState<Awaited<ReturnType<typeof listSales>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingSales, setClearingSales] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [datePreset, setDatePreset] = useState<SalesDatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedByKey, setExpandedByKey] = useState<Record<string, boolean>>({});
  const isOperationLocked = saving || clearingSales;

  const loadSalesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCatalogError(null);
    try {
      const [salesRes, productsRes] = await Promise.allSettled([listSales(), listProducts()]);

      if (salesRes.status === "fulfilled") {
        setSales(salesRes.value);
      } else {
        setSales([]);
        const message =
          salesRes.reason instanceof Error
            ? salesRes.reason.message
            : "No fue posible cargar ventas.";
        setError(message);
      }

      if (productsRes.status === "fulfilled") {
        setProductsCatalog(productsRes.value);
      } else {
        setProductsCatalog([]);
        const message =
          productsRes.reason instanceof Error
            ? productsRes.reason.message
            : "No fue posible cargar productos para venta asistida.";
        setCatalogError(message);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible cargar ventas.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSalesData();
  }, [loadSalesData, syncTick]);

  const sortedSales = useMemo(
    () =>
      [...sales].sort((a, b) =>
        String(b.fechaISO || b.createdAt || "").localeCompare(
          String(a.fechaISO || a.createdAt || "")
        )
      ),
    [sales]
  );

  const dateFilteredSales = useMemo(() => {
    const now = new Date();
    return sortedSales.filter((sale) => {
      if (datePreset === "all") {
        return true;
      }
      const saleDate = parseRecordDate(sale.fechaISO || sale.createdAt);
      if (!saleDate) {
        return false;
      }
      if (datePreset === "today") {
        return isSameLocalDay(saleDate, now);
      }
      if (datePreset === "month") {
        return isInCurrentLocalMonth(saleDate, now);
      }
      return isWithinDateRangeInput(saleDate, dateFrom, dateTo);
    });
  }, [sortedSales, datePreset, dateFrom, dateTo]);

  const filteredSales = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return dateFilteredSales;
    }
    return dateFilteredSales.filter((sale) =>
      [sale.refId, sale.clienteNombre, sale.clienteTelefono, sale.userName]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [dateFilteredSales, query]);

  const salesStats = useMemo(() => {
    const totalCount = filteredSales.length;
    const totalAmount = filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    return { totalCount, totalAmount };
  }, [filteredSales]);

  const revenueSummary = useMemo(
    () => computeSalesRevenueSummary(sales),
    [sales]
  );

  const filteredCatalog = useMemo(() => {
    const term = catalogQuery.trim().toLowerCase();
    const source = term
      ? productsCatalog.filter((product) =>
          String(product.nombre || "").toLowerCase().includes(term)
        )
      : productsCatalog;
    return source.slice(0, 10);
  }, [catalogQuery, productsCatalog]);

  const selectedDraftProduct = useMemo(
    () => productsCatalog.find((product) => getProductKey(product) === draft.productKey) || null,
    [productsCatalog, draft.productKey]
  );

  const draftQuantity = toInteger(draft.cantidad, 0);
  const draftUnitPrice = selectedDraftProduct
    ? getPresentationPrice(selectedDraftProduct, draft.presentacion)
    : 0;
  const assistedTotal = useMemo(
    () =>
      assistedItems.reduce(
        (sum, item) => sum + (Number(item.subtotal) || (Number(item.precioUnit) || 0) * (Number(item.cantidad) || 0)),
        0
      ),
    [assistedItems]
  );

  const onRefreshSales = useCallback(async () => {
    if (isOperationLocked || refreshing) {
      return;
    }
    setRefreshing(true);
    try {
      await loadSalesData();
    } finally {
      setRefreshing(false);
    }
  }, [isOperationLocked, loadSalesData, refreshing]);

  const updateForm = <K extends keyof SaleFormState>(key: K, value: SaleFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const hasSearchQuery = query.trim().length > 0;
  const hasDateRangeInput =
    datePreset === "range" && (dateFrom.trim().length > 0 || dateTo.trim().length > 0);
  const hasHistoryFilters = hasSearchQuery || datePreset !== "all" || hasDateRangeInput;

  const clearHistoryFilters = () => {
    if (isOperationLocked) {
      return;
    }
    setQuery("");
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
  };

  const onSelectDraftProduct = (product: Product) => {
    if (isOperationLocked) {
      return;
    }
    setDraft((prev) => ({ ...prev, productKey: getProductKey(product) }));
  };

  const onAddAssistedItem = () => {
    if (isOperationLocked) {
      return;
    }
    if (!selectedDraftProduct) {
      Alert.alert("Validacion", "Selecciona un producto.");
      return;
    }
    if (draftQuantity <= 0) {
      Alert.alert("Validacion", "La cantidad debe ser mayor a 0.");
      return;
    }
    if (draftUnitPrice <= 0) {
      Alert.alert(
        "Precio no valido",
        "El precio de la presentacion seleccionada es 0. Ajusta el producto en Inventario."
      );
      return;
    }

    const itemId = String(selectedDraftProduct.externalId || selectedDraftProduct.id || "");
    const nextItem: SaleItem = {
      id: itemId || undefined,
      nombre: selectedDraftProduct.nombre || "Producto",
      presentacion: draft.presentacion,
      precioUnit: draftUnitPrice,
      cantidad: draftQuantity,
      subtotal: draftUnitPrice * draftQuantity,
    };

    setAssistedItems((prev) => {
      const existingIdx = prev.findIndex(
        (line) => String(line.id || "") === String(nextItem.id || "") && line.presentacion === nextItem.presentacion
      );
      if (existingIdx < 0) {
        return [...prev, nextItem];
      }
      const clone = [...prev];
      const current = clone[existingIdx];
      const cantidad = (Number(current.cantidad) || 0) + nextItem.cantidad;
      const precioUnit = Number(current.precioUnit) || 0;
      clone[existingIdx] = {
        ...current,
        cantidad,
        subtotal: precioUnit * cantidad,
      };
      return clone;
    });

    setDraft((prev) => ({ ...prev, cantidad: "1" }));
  };

  const onRemoveAssistedItem = (index: number) => {
    if (isOperationLocked) {
      return;
    }
    setAssistedItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const onClearAssistedItems = () => {
    if (isOperationLocked || !assistedItems.length) {
      return;
    }
    setAssistedItems([]);
  };

  const onCreateSale = async () => {
    if (isOperationLocked) {
      return;
    }
    const total = assistedItems.length ? assistedTotal : toNumber(form.total, 0);
    if (total <= 0) {
      Alert.alert("Validacion", "El total debe ser mayor a 0.");
      return;
    }

    setSaving(true);
    try {
      const items = assistedItems.length ? assistedItems : normalizeItemsFromText(form.itemsJson);
      await createSale({
        refId: form.refId.trim() || undefined,
        clienteNombre: form.clienteNombre.trim(),
        clienteTelefono: form.clienteTelefono.trim(),
        total,
        items,
        metodoPago: form.metodoPago.trim(),
      });
      setForm(initialForm);
      setDraft(initialSaleDraft);
      setAssistedItems([]);
      setCatalogQuery("");
      await loadSalesData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible registrar venta.";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const onClearSales = () => {
    if (clearingSales) {
      return;
    }
    Alert.alert("Eliminar ventas", "Esta accion borra todas las ventas (solo owner).", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Continuar",
        style: "destructive",
        onPress: async () => {
          Alert.alert(
            "Confirmacion final",
            "Esta accion no se puede deshacer desde la app. Deseas continuar?",
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Eliminar todo",
                style: "destructive",
                onPress: async () => {
                  setClearingSales(true);
                  try {
                    await clearSales();
                    await loadSalesData();
                  } catch (e) {
                    const message =
                      e instanceof Error ? e.message : "No fue posible eliminar ventas.";
                    Alert.alert("Error", message);
                  } finally {
                    setClearingSales(false);
                  }
                },
              },
            ]
          );
        },
      },
    ]);
  };

  const onExportSales = async () => {
    if (isOperationLocked) {
      return;
    }
    const rows: Array<Array<unknown>> = [
      [
        "id",
        "refId",
        "fechaISO",
        "clienteNombre",
        "clienteTelefono",
        "userName",
        "metodoPago",
        "total",
        "items_json",
      ],
      ...filteredSales.map((sale) => [
        sale.id || "",
        sale.refId || "",
        sale.fechaISO || sale.createdAt || "",
        sale.clienteNombre || "",
        sale.clienteTelefono || "",
        sale.userName || "",
        sale.metodoPago || "",
        sale.total || 0,
        JSON.stringify(sale.items || []),
      ]),
    ];

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await exportCsvFile(`ventas_renacer_${stamp}.csv`, rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible exportar ventas.";
      Alert.alert("Error", message);
    }
  };

  const onFillItemsTemplate = () => {
    if (isOperationLocked) {
      return;
    }
    updateForm("itemsJson", saleItemsTemplate);
  };

  const totalFieldValue = assistedItems.length ? String(assistedTotal) : form.total;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={() => void onRefreshSales()}>
      <SectionCard title="Registrar venta">
        <Text style={styles.subtle}>Puedes registrar ventas manuales para operaciones de mostrador.</Text>
        <FormField
          label="Referencia (opcional)"
          value={form.refId}
          onChangeText={(value) => updateForm("refId", value)}
          editable={!isOperationLocked}
        />
        <FormField
          label="Cliente"
          value={form.clienteNombre}
          onChangeText={(value) => updateForm("clienteNombre", value)}
          placeholder="Consumidor final"
          editable={!isOperationLocked}
        />
        <FormField
          label="Telefono"
          value={form.clienteTelefono}
          onChangeText={(value) => updateForm("clienteTelefono", value)}
          keyboardType="phone-pad"
          editable={!isOperationLocked}
        />
        <View style={styles.assistedCard}>
          <Text style={styles.assistedTitle}>Items asistidos (recomendado)</Text>
          <Text style={styles.assistedSubtitle}>
            Selecciona producto + presentacion + cantidad. El total se calcula solo.
          </Text>
          <FormField
            label="Buscar producto"
            value={catalogQuery}
            onChangeText={setCatalogQuery}
            placeholder="Nombre del producto"
            editable={!isOperationLocked}
          />
          <View style={styles.catalogChipsRow}>
            {filteredCatalog.map((product) => {
              const key = getProductKey(product);
              const selected = key === draft.productKey;
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.catalogChip,
                    selected && styles.catalogChipActive,
                    isOperationLocked && styles.controlDisabled,
                  ]}
                  onPress={() => onSelectDraftProduct(product)}
                  disabled={isOperationLocked}
                >
                  <Text
                    style={[
                      styles.catalogChipText,
                      selected && styles.catalogChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {product.nombre}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!filteredCatalog.length ? (
            <Text style={styles.assistedHint}>No hay productos para ese filtro.</Text>
          ) : null}
          {selectedDraftProduct ? (
            <Text style={styles.assistedHint}>
              Seleccionado: {selectedDraftProduct.nombre}
            </Text>
          ) : null}

          <View style={styles.presentationRow}>
            {salePresentationButtons.map((button) => {
              const active = draft.presentacion === button.value;
              return (
                <Pressable
                  key={button.value}
                  style={[
                    styles.presentationButton,
                    active && styles.presentationButtonActive,
                    isOperationLocked && styles.controlDisabled,
                  ]}
                  onPress={() => setDraft((prev) => ({ ...prev, presentacion: button.value }))}
                  disabled={isOperationLocked}
                >
                  <Text
                    style={[
                      styles.presentationButtonText,
                      active && styles.presentationButtonTextActive,
                    ]}
                  >
                    {button.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <FormField
            label="Cantidad"
            value={draft.cantidad}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, cantidad: value }))}
            keyboardType="numeric"
            editable={!isOperationLocked}
          />
          <Text style={styles.assistedHint}>
            Precio unitario: {formatCurrencyCOP(draftUnitPrice)}
          </Text>
          <View style={styles.assistedActionsRow}>
            <View style={styles.assistedActionItem}>
              <ActionButton
                label="Agregar item"
                onPress={onAddAssistedItem}
                disabled={isOperationLocked}
              />
            </View>
            <View style={styles.assistedActionItem}>
              <ActionButton
                label="Limpiar items"
                variant="secondary"
                onPress={onClearAssistedItems}
                disabled={isOperationLocked || !assistedItems.length}
              />
            </View>
          </View>
          {assistedItems.map((line, index) => (
            <View key={`${line.id || line.nombre}-${line.presentacion}-${index}`} style={styles.assistedItemRow}>
              <View style={styles.assistedItemInfo}>
                <Text style={styles.assistedItemTitle}>
                  {line.nombre} ({line.presentacion})
                </Text>
                <Text style={styles.assistedItemMeta}>
                  {formatCurrencyCOP(line.precioUnit)} x {line.cantidad}
                </Text>
              </View>
              <View style={styles.assistedItemRight}>
                <Text style={styles.assistedItemSubtotal}>{formatCurrencyCOP(line.subtotal)}</Text>
                <Pressable
                  style={[styles.assistedRemoveButton, isOperationLocked && styles.controlDisabled]}
                  onPress={() => onRemoveAssistedItem(index)}
                  disabled={isOperationLocked}
                >
                  <Text style={styles.assistedRemoveButtonText}>Quitar</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {assistedItems.length ? (
            <Text style={styles.assistedTotalText}>Total asistido: {formatCurrencyCOP(assistedTotal)}</Text>
          ) : null}
          {catalogError ? <Text style={styles.error}>{catalogError}</Text> : null}
        </View>
        <FormField
          label="Total *"
          value={totalFieldValue}
          onChangeText={(value) => updateForm("total", value)}
          keyboardType="numeric"
          editable={!isOperationLocked && !assistedItems.length}
        />
        {assistedItems.length ? (
          <Text style={styles.assistedHint}>Total bloqueado porque hay items asistidos.</Text>
        ) : null}
        <FormField
          label="Metodo de pago"
          value={form.metodoPago}
          onChangeText={(value) => updateForm("metodoPago", value)}
          placeholder="efectivo, nequi, daviplata..."
          editable={!isOperationLocked}
        />
        <Pressable
          style={[styles.advancedToggleButton, isOperationLocked && styles.controlDisabled]}
          onPress={() => setShowAdvancedJson((prev) => !prev)}
          disabled={isOperationLocked}
        >
          <Text style={styles.advancedToggleButtonText}>
            {showAdvancedJson ? "Ocultar JSON avanzado" : "Mostrar JSON avanzado"}
          </Text>
        </Pressable>
        {showAdvancedJson ? (
          <>
            <FormField
              label="Items JSON (opcional, avanzado)"
              value={form.itemsJson}
              onChangeText={(value) => updateForm("itemsJson", value)}
              placeholder={saleItemsPlaceholder}
              multiline
              editable={!isOperationLocked}
            />
            <Text style={styles.itemsJsonHelper}>
              Campo tecnico. Si no lo necesitas, dejalo vacio.
            </Text>
            <View style={styles.templateRow}>
              <Pressable
                style={[styles.templateButton, isOperationLocked && styles.controlDisabled]}
                onPress={onFillItemsTemplate}
                disabled={isOperationLocked}
              >
                <Text style={styles.templateButtonText}>Usar plantilla JSON</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        <ActionButton
          label="Guardar venta"
          onPress={() => void onCreateSale()}
          loading={saving}
          disabled={isOperationLocked}
        />
        {role === "owner" ? (
          <ActionButton
            label="Borrar ventas (owner)"
            variant="danger"
            onPress={onClearSales}
            loading={clearingSales}
            disabled={isOperationLocked}
          />
        ) : null}
        {clearingSales ? (
          <View style={styles.pendingActionBar}>
            <ActivityIndicator color={theme.colors.primaryStrong} size="small" />
            <Text style={styles.pendingActionText}>Eliminando ventas...</Text>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Historial de ventas">
        <View style={styles.statsRow}>
          <View style={styles.statsItem}>
            <KpiCard
              label="Ventas"
              value={String(salesStats.totalCount)}
              icon="receipt-outline"
              tone="primary"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Ingresos Filtrados"
              value={formatCurrencyCOP(salesStats.totalAmount)}
              icon="cash-outline"
              tone="success"
              compact
            />
          </View>
        </View>
        <View style={styles.statsRow}>
          {revenueCards.map((card) => {
            const value =
              card.key === "today"
                ? revenueSummary.today
                : card.key === "month"
                ? revenueSummary.month
                : revenueSummary.year;
            const toneStyle =
              card.key === "today"
                ? styles.revenueCardToday
                : card.key === "month"
                ? styles.revenueCardMonth
                : styles.revenueCardYear;
            const iconColor =
              card.key === "today"
                ? theme.colors.primaryStrong
                : card.key === "month"
                ? theme.colors.warning
                : theme.colors.success;
            return (
              <View key={card.key} style={[styles.revenueCard, toneStyle]}>
                <View style={styles.revenueHeader}>
                  <View style={styles.revenueIconWrap}>
                    <Ionicons name={card.icon} size={14} color={iconColor} />
                  </View>
                  <View style={styles.revenueLabelBlock}>
                    <Text style={styles.revenueLabel}>{card.label}</Text>
                    <Text style={styles.revenueHelper}>{card.helper}</Text>
                  </View>
                </View>
                <Text
                  style={styles.revenueValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {formatCurrencyCOP(value)}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.sectionLabel}>Filtrar por fecha</Text>
        <View style={styles.filterRow}>
          {salesDateFilterButtons.map((button) => {
            const active = datePreset === button.value;
            return (
              <Pressable
                key={button.value}
                onPress={() => setDatePreset(button.value)}
                style={[
                  styles.filterButton,
                  active && styles.filterButtonActive,
                  isOperationLocked && styles.controlDisabled,
                ]}
                disabled={isOperationLocked}
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
                editable={!isOperationLocked}
              />
            </View>
            <View style={styles.dateRangeField}>
              <FormField
                label="Hasta"
                value={dateTo}
                onChangeText={(value) => setDateTo(sanitizeDateInput(value))}
                placeholder="2026-02-28"
                editable={!isOperationLocked}
              />
            </View>
          </View>
        ) : null}
        <FormField
          label="Buscar en historial"
          value={query}
          onChangeText={setQuery}
          placeholder="Ref, cliente, telefono o vendedor"
          editable={!isOperationLocked}
        />
        <View style={styles.searchSummaryRow}>
          <Text style={styles.subtle}>Mostrando {filteredSales.length} ventas</Text>
          {hasHistoryFilters ? (
            <Pressable
              style={[styles.clearSearchButton, isOperationLocked && styles.controlDisabled]}
              onPress={clearHistoryFilters}
              disabled={isOperationLocked}
            >
              <Text style={styles.clearSearchButtonText}>Limpiar filtros</Text>
            </Pressable>
          ) : null}
        </View>
        <ActionButton
          label="Exportar CSV"
          variant="secondary"
          onPress={() => void onExportSales()}
          disabled={isOperationLocked}
        />
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.subtle}>Cargando ventas...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && filteredSales.length === 0 ? (
          <EmptyState
            title="Sin ventas"
            subtitle={
              hasHistoryFilters
                ? "No hay ventas para los filtros seleccionados."
                : "Aun no hay ventas registradas."
            }
          />
        ) : null}
      </SectionCard>

      <FlatList
        data={filteredSales}
        keyExtractor={(item, index) => `${item.id || item.refId || `sale-${index}`}`}
        scrollEnabled={false}
        renderItem={({ item, index }) => {
          const key = `${item.id || item.refId || `sale-${index}`}`;
          const expanded = !!expandedByKey[key];
          return (
            <SectionCard>
              <View style={styles.saleTopRow}>
                <View style={styles.saleIdentity}>
                  <Text style={styles.saleTitle}>
                    {item.refId ? `Ref ${item.refId}` : `Venta #${item.id || "--"}`}
                  </Text>
                  <Text style={styles.saleMetaStrong}>
                    {item.clienteNombre || "Consumidor final"}
                  </Text>
                </View>
                <Text style={styles.saleTotal}>{formatCurrencyCOP(item.total)}</Text>
              </View>
              <View style={styles.salePillRow}>
                <View style={styles.salePill}>
                  <Text style={styles.salePillText}>Items {(item.items || []).length}</Text>
                </View>
                <View style={styles.salePill}>
                  <Text style={styles.salePillText}>Pago {item.metodoPago || "--"}</Text>
                </View>
              </View>
              <Text style={styles.saleMeta}>Tel: {item.clienteTelefono || "--"}</Text>
              <Text style={styles.saleMeta}>Vendedor: {item.userName || "--"}</Text>
              <Text style={styles.saleMeta}>
                Fecha: {formatDateTime(item.fechaISO || item.createdAt)}
              </Text>

              {(item.items || []).length ? (
                <Pressable
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedByKey((prev) => ({
                      ...prev,
                      [key]: !prev[key],
                    }))
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expanded ? "Ocultar detalle" : "Ver detalle"}
                  </Text>
                </Pressable>
              ) : null}

              {expanded
                ? (item.items || []).map((line, lineIdx) => (
                    <View key={`${key}-line-${lineIdx}`} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>
                          {line.nombre || "Producto"} ({line.presentacion || "--"})
                        </Text>
                        <Text style={styles.itemMeta}>
                          {formatCurrencyCOP(line.precioUnit)} x {line.cantidad}
                        </Text>
                      </View>
                      <Text style={styles.itemSubtotal}>{formatCurrencyCOP(line.subtotal)}</Text>
                    </View>
                  ))
                : null}
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statsItem: {
    flex: 1,
    minWidth: 150,
  },
  assistedCard: {
    borderWidth: 1,
    borderColor: "rgba(33,128,141,0.2)",
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(33,128,141,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  assistedTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  assistedSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  catalogChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catalogChip: {
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  catalogChipActive: {
    borderColor: "rgba(33,128,141,0.35)",
    backgroundColor: "rgba(33,128,141,0.14)",
  },
  catalogChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  catalogChipTextActive: {
    color: theme.colors.primaryStrong,
    fontWeight: "800",
  },
  presentationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presentationButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  presentationButtonActive: {
    borderColor: "rgba(33,128,141,0.35)",
    backgroundColor: "rgba(33,128,141,0.14)",
  },
  presentationButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  presentationButtonTextActive: {
    color: theme.colors.primaryStrong,
    fontWeight: "800",
  },
  assistedHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  assistedActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  assistedActionItem: {
    flex: 1,
  },
  assistedItemRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  assistedItemInfo: {
    flex: 1,
    gap: 2,
  },
  assistedItemTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  assistedItemMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  assistedItemRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  assistedItemSubtotal: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  assistedRemoveButton: {
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assistedRemoveButtonText: {
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: "800",
  },
  assistedTotalText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "900",
  },
  advancedToggleButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  advancedToggleButtonText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  revenueCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 7,
  },
  revenueCardToday: {
    borderColor: "rgba(11,99,208,0.24)",
    backgroundColor: "rgba(11,99,208,0.06)",
  },
  revenueCardMonth: {
    borderColor: "rgba(245,158,11,0.32)",
    backgroundColor: "rgba(245,158,11,0.09)",
  },
  revenueCardYear: {
    borderColor: "rgba(16,185,129,0.28)",
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  revenueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  revenueIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  revenueLabelBlock: {
    flex: 1,
    gap: 1,
  },
  revenueLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  revenueHelper: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  revenueValue: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
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
  dateRangeRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateRangeField: {
    flex: 1,
  },
  templateRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  itemsJsonHelper: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  templateButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  templateButtonText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  searchSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  controlDisabled: {
    opacity: 0.55,
  },
  pendingActionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(33,128,141,0.25)",
    backgroundColor: "rgba(33,128,141,0.08)",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pendingActionText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
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
  error: {
    color: "#991b1b",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    padding: 8,
  },
  saleTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  saleIdentity: {
    flex: 1,
    gap: 2,
  },
  saleTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  saleMetaStrong: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  saleMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  salePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  salePill: {
    borderWidth: 1,
    borderColor: "rgba(33,128,141,0.24)",
    backgroundColor: "rgba(33,128,141,0.08)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  salePillText: {
    color: theme.colors.primaryStrong,
    fontSize: 11,
    fontWeight: "800",
  },
  saleTotal: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
  expandButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  expandButtonText: {
    color: theme.colors.primaryStrong,
    fontWeight: "700",
    fontSize: 12,
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
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
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
});
