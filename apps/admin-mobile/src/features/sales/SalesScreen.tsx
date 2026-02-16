import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { clearSales, createSale, listSales } from "../../api/modules/sales";
import { SaleItem, UserRole } from "../../types/domain";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionCard } from "../../components/SectionCard";
import { FormField } from "../../components/FormField";
import { ActionButton } from "../../components/ActionButton";
import { EmptyState } from "../../components/EmptyState";
import { KpiCard } from "../../components/KpiCard";
import { formatCurrencyCOP, formatDateTime, toNumber } from "../../lib/format";
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

interface SaleFormState {
  refId: string;
  clienteNombre: string;
  clienteTelefono: string;
  total: string;
  metodoPago: string;
  itemsJson: string;
}

const initialForm: SaleFormState = {
  refId: "",
  clienteNombre: "",
  clienteTelefono: "",
  total: "",
  metodoPago: "",
  itemsJson: "",
};

const saleItemsTemplate =
  '[{"nombre":"Producto","presentacion":"caja","precioUnit":1000,"cantidad":1,"subtotal":1000}]';

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
  const [sales, setSales] = useState<Awaited<ReturnType<typeof listSales>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingSales, setClearingSales] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [datePreset, setDatePreset] = useState<SalesDatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedByKey, setExpandedByKey] = useState<Record<string, boolean>>({});

  const loadSalesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSales();
      setSales(rows);
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

  const updateForm = <K extends keyof SaleFormState>(key: K, value: SaleFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const hasSearchQuery = query.trim().length > 0;
  const hasDateRangeInput =
    datePreset === "range" && (dateFrom.trim().length > 0 || dateTo.trim().length > 0);
  const hasHistoryFilters = hasSearchQuery || datePreset !== "all" || hasDateRangeInput;

  const clearHistoryFilters = () => {
    setQuery("");
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
  };

  const onCreateSale = async () => {
    const total = toNumber(form.total, 0);
    if (total <= 0) {
      Alert.alert("Validacion", "El total debe ser mayor a 0.");
      return;
    }

    setSaving(true);
    try {
      const items = normalizeItemsFromText(form.itemsJson);
      await createSale({
        refId: form.refId.trim() || undefined,
        clienteNombre: form.clienteNombre.trim(),
        clienteTelefono: form.clienteTelefono.trim(),
        total,
        items,
        metodoPago: form.metodoPago.trim(),
      });
      setForm(initialForm);
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
    updateForm("itemsJson", saleItemsTemplate);
  };

  return (
    <ScreenContainer>
      <SectionCard title="Registrar venta">
        <Text style={styles.subtle}>Puedes registrar ventas manuales para operaciones de mostrador.</Text>
        <FormField label="Referencia (opcional)" value={form.refId} onChangeText={(value) => updateForm("refId", value)} />
        <FormField
          label="Cliente"
          value={form.clienteNombre}
          onChangeText={(value) => updateForm("clienteNombre", value)}
          placeholder="Consumidor final"
        />
        <FormField
          label="Telefono"
          value={form.clienteTelefono}
          onChangeText={(value) => updateForm("clienteTelefono", value)}
          keyboardType="phone-pad"
        />
        <FormField
          label="Total *"
          value={form.total}
          onChangeText={(value) => updateForm("total", value)}
          keyboardType="numeric"
        />
        <FormField
          label="Metodo de pago"
          value={form.metodoPago}
          onChangeText={(value) => updateForm("metodoPago", value)}
          placeholder="efectivo, nequi, daviplata..."
        />
        <FormField
          label="Items JSON (opcional)"
          value={form.itemsJson}
          onChangeText={(value) => updateForm("itemsJson", value)}
          placeholder={saleItemsTemplate}
          multiline
        />
        <View style={styles.templateRow}>
          <Pressable style={styles.templateButton} onPress={onFillItemsTemplate}>
            <Text style={styles.templateButtonText}>Usar plantilla JSON</Text>
          </Pressable>
        </View>
        <ActionButton
          label="Guardar venta"
          onPress={() => void onCreateSale()}
          loading={saving}
          disabled={clearingSales}
        />
        {role === "owner" ? (
          <ActionButton
            label="Borrar ventas (owner)"
            variant="danger"
            onPress={onClearSales}
            loading={clearingSales}
            disabled={saving}
          />
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
          <View style={styles.statsItem}>
            <KpiCard
              label="Ingresos Hoy"
              value={formatCurrencyCOP(revenueSummary.today)}
              icon="today-outline"
              tone="success"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Ingresos Mes"
              value={formatCurrencyCOP(revenueSummary.month)}
              icon="calendar-outline"
              tone="success"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Ingresos Ano"
              value={formatCurrencyCOP(revenueSummary.year)}
              icon="trending-up-outline"
              tone="success"
              compact
            />
          </View>
        </View>
        <Text style={styles.sectionLabel}>Filtrar por fecha</Text>
        <View style={styles.filterRow}>
          {salesDateFilterButtons.map((button) => {
            const active = datePreset === button.value;
            return (
              <Pressable
                key={button.value}
                onPress={() => setDatePreset(button.value)}
                style={[styles.filterButton, active && styles.filterButtonActive]}
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
              />
            </View>
            <View style={styles.dateRangeField}>
              <FormField
                label="Hasta"
                value={dateTo}
                onChangeText={(value) => setDateTo(sanitizeDateInput(value))}
                placeholder="2026-02-28"
              />
            </View>
          </View>
        ) : null}
        <FormField
          label="Buscar en historial"
          value={query}
          onChangeText={setQuery}
          placeholder="Ref, cliente, telefono o vendedor"
        />
        <View style={styles.searchSummaryRow}>
          <Text style={styles.subtle}>Mostrando {filteredSales.length} ventas</Text>
          {hasHistoryFilters ? (
            <Pressable style={styles.clearSearchButton} onPress={clearHistoryFilters}>
              <Text style={styles.clearSearchButtonText}>Limpiar filtros</Text>
            </Pressable>
          ) : null}
        </View>
        <ActionButton
          label="Exportar CSV"
          variant="secondary"
          onPress={() => void onExportSales()}
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
