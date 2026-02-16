import { useCallback, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "../../api/modules/products";
import { Product, ProductPayload } from "../../types/domain";
import { ScreenContainer } from "../../components/ScreenContainer";
import { FormField } from "../../components/FormField";
import { ActionButton } from "../../components/ActionButton";
import { SectionCard } from "../../components/SectionCard";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { KpiCard } from "../../components/KpiCard";
import { formatCurrencyCOP, toInteger, toNumber } from "../../lib/format";
import { theme } from "../../constants/theme";
import { useSyncStore } from "../../store/sync-store";
import { exportCsvFile } from "../../lib/csv-export";

const LOW_STOCK_LIMIT = 2;

interface ProductFormState {
  nombre: string;
  descripcion: string;
  categoria: string;
  disponibilidad: string;
  imagen: string;
  precioCaja: string;
  precioSobre: string;
  precioUnidad: string;
  sobresXCaja: string;
  unidadesXSobre: string;
  stockCajas: string;
  ofertaActiva: boolean;
  ofertaTexto: string;
  ofertaPrecioCaja: string;
  ofertaPrecioSobre: string;
}

const emptyForm: ProductFormState = {
  nombre: "",
  descripcion: "",
  categoria: "Medicamentos",
  disponibilidad: "Disponible",
  imagen: "",
  precioCaja: "0",
  precioSobre: "0",
  precioUnidad: "0",
  sobresXCaja: "0",
  unidadesXSobre: "0",
  stockCajas: "0",
  ofertaActiva: false,
  ofertaTexto: "",
  ofertaPrecioCaja: "0",
  ofertaPrecioSobre: "0",
};

const productToForm = (product: Product): ProductFormState => ({
  nombre: product.nombre || "",
  descripcion: product.descripcion || "",
  categoria: product.categoria || "Medicamentos",
  disponibilidad: product.disponibilidad || "Disponible",
  imagen: product.imagen || "",
  precioCaja: String(product.precioCaja || 0),
  precioSobre: String(product.precioSobre || 0),
  precioUnidad: String(product.precioUnidad || 0),
  sobresXCaja: String(product.sobresXCaja || 0),
  unidadesXSobre: String(product.unidadesXSobre || 0),
  stockCajas: String(product.stockCajas || 0),
  ofertaActiva: !!product.ofertaActiva,
  ofertaTexto: product.ofertaTexto || "",
  ofertaPrecioCaja: String(product.ofertaPrecioCaja || 0),
  ofertaPrecioSobre: String(product.ofertaPrecioSobre || 0),
});

const getProductKey = (product: Product) => String(product.externalId || product.id);

export const ProductsScreen = () => {
  const syncTick = useSyncStore((state) => state.syncTick);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deletingProductKey, setDeletingProductKey] = useState<string | null>(null);

  const loadProductsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProducts();
      setProducts(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible cargar productos.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProductsData();
  }, [loadProductsData, syncTick]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((product) => {
      const category = String(product.categoria || "").trim();
      if (category) {
        set.add(category);
      }
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const productStats = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter((product) => {
      const stock = Number(product.stockCajas) || 0;
      return stock > 0 && stock <= LOW_STOCK_LIMIT;
    }).length;
    const outOfStock = products.filter((product) => (Number(product.stockCajas) || 0) <= 0).length;
    const activeOffers = products.filter((product) => !!product.ofertaActiva).length;
    return { total, lowStock, outOfStock, activeOffers };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter !== "all" && String(product.categoria || "") !== categoryFilter) {
        return false;
      }
      if (lowStockOnly) {
        const stock = Number(product.stockCajas) || 0;
        if (!(stock > 0 && stock <= LOW_STOCK_LIMIT)) {
          return false;
        }
      }
      if (!term) {
        return true;
      }
      return [product.nombre, product.descripcion, product.categoria]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [products, query, lowStockOnly, categoryFilter]);

  const updateForm = <K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm(productToForm(product));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingProduct(null);
    setForm(emptyForm);
  };

  const buildPayload = (): ProductPayload => ({
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim(),
    categoria: form.categoria.trim(),
    disponibilidad: form.disponibilidad.trim(),
    imagen: form.imagen.trim(),
    precioCaja: toNumber(form.precioCaja, 0),
    precioSobre: toNumber(form.precioSobre, 0),
    precioUnidad: toNumber(form.precioUnidad, 0),
    sobresXCaja: toInteger(form.sobresXCaja, 0),
    unidadesXSobre: toInteger(form.unidadesXSobre, 0),
    stockCajas: toInteger(form.stockCajas, 0),
    ofertaActiva: form.ofertaActiva,
    ofertaTexto: form.ofertaTexto.trim(),
    ofertaPrecioCaja: toNumber(form.ofertaPrecioCaja, 0),
    ofertaPrecioSobre: toNumber(form.ofertaPrecioSobre, 0),
  });

  const onSaveProduct = async () => {
    if (!form.nombre.trim()) {
      Alert.alert("Validacion", "El nombre del producto es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingProduct) {
        await updateProduct(editingProduct, payload);
      } else {
        await createProduct(payload);
      }
      closeModal();
      await loadProductsData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible guardar el producto.";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const onDeleteProduct = (product: Product) => {
    if (deletingProductKey) {
      return;
    }
    const productKey = getProductKey(product);
    const stock = Number(product.stockCajas) || 0;

    Alert.alert("Eliminar producto", `Deseas iniciar eliminacion de "${product.nombre}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Continuar",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Confirmacion final",
            `Esta accion eliminara "${product.nombre}" de forma permanente desde admin.\n\nID: ${
              product.externalId || product.id || "--"
            }\nStock cajas: ${stock}\n\nNo se puede deshacer desde la app.`,
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Eliminar definitivo",
                style: "destructive",
                onPress: async () => {
                  setDeletingProductKey(productKey);
                  try {
                    await deleteProduct(product);
                    await loadProductsData();
                  } catch (e) {
                    const message =
                      e instanceof Error ? e.message : "No fue posible eliminar el producto.";
                    Alert.alert("Error", message);
                  } finally {
                    setDeletingProductKey(null);
                  }
                },
              },
            ]
          );
        },
      },
    ]);
  };

  const hasActiveFilters = query.trim().length > 0 || lowStockOnly || categoryFilter !== "all";

  const onClearFilters = () => {
    setQuery("");
    setLowStockOnly(false);
    setCategoryFilter("all");
  };

  const onExportProducts = async () => {
    const rows: Array<Array<unknown>> = [
      [
        "id",
        "externalId",
        "nombre",
        "descripcion",
        "categoria",
        "disponibilidad",
        "imagen",
        "precioCaja",
        "precioSobre",
        "precioUnidad",
        "sobresXCaja",
        "unidadesXSobre",
        "stockCajas",
        "ofertaActiva",
        "ofertaTexto",
        "ofertaPrecioCaja",
        "ofertaPrecioSobre",
      ],
      ...filteredProducts.map((product) => [
        product.id,
        product.externalId || "",
        product.nombre,
        product.descripcion,
        product.categoria,
        product.disponibilidad,
        product.imagen,
        product.precioCaja,
        product.precioSobre,
        product.precioUnidad,
        product.sobresXCaja,
        product.unidadesXSobre,
        product.stockCajas,
        product.ofertaActiva ? 1 : 0,
        product.ofertaTexto,
        product.ofertaPrecioCaja,
        product.ofertaPrecioSobre,
      ]),
    ];

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await exportCsvFile(`productos_renacer_${stamp}.csv`, rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible exportar productos.";
      Alert.alert("Error", message);
    }
  };

  return (
    <ScreenContainer>
      <SectionCard title="Gestion de productos">
        <Text style={styles.subtitle}>CRUD completo con endpoint existente.</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <KpiCard
              label="Productos"
              value={String(productStats.total)}
              tone="primary"
              icon="cube-outline"
              compact
            />
          </View>
          <View style={styles.metricItem}>
            <KpiCard
              label="Stock Bajo"
              value={String(productStats.lowStock)}
              tone="warning"
              icon="alert-circle-outline"
              compact
            />
          </View>
          <View style={styles.metricItem}>
            <KpiCard
              label="Sin Stock"
              value={String(productStats.outOfStock)}
              tone="danger"
              icon="close-circle-outline"
              compact
            />
          </View>
          <View style={styles.metricItem}>
            <KpiCard
              label="Ofertas Activas"
              value={String(productStats.activeOffers)}
              tone="success"
              icon="pricetags-outline"
              compact
            />
          </View>
        </View>
        <FormField
          label="Buscar producto"
          value={query}
          onChangeText={setQuery}
          placeholder="Nombre, descripcion o categoria"
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Solo stock bajo</Text>
          <Switch value={lowStockOnly} onValueChange={setLowStockOnly} />
        </View>
        <View style={styles.categoryFilterRow}>
          {categories.map((category) => {
            const isActive = categoryFilter === category;
            return (
              <Pressable
                key={category}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setCategoryFilter(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                  ]}
                >
                  {category === "all" ? "Todas" : category}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.filterSummaryRow}>
          <Text style={styles.filterSummaryText}>
            Mostrando {filteredProducts.length} de {products.length}
          </Text>
          {hasActiveFilters ? (
            <Pressable style={styles.clearFilterButton} onPress={onClearFilters}>
              <Text style={styles.clearFilterButtonText}>Limpiar filtros</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.sectionActionsRow}>
          <View style={styles.sectionActionItem}>
            <ActionButton
              label="Nuevo producto"
              onPress={openCreateModal}
              disabled={!!deletingProductKey}
            />
          </View>
          <View style={styles.sectionActionItem}>
            <ActionButton
              label="Exportar CSV"
              variant="secondary"
              onPress={() => void onExportProducts()}
              disabled={!!deletingProductKey}
            />
          </View>
        </View>
        {deletingProductKey ? (
          <View style={styles.pendingActionBar}>
            <ActivityIndicator color={theme.colors.primaryStrong} size="small" />
            <Text style={styles.pendingActionText}>Eliminando producto...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SectionCard>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      ) : null}

      {!loading && filteredProducts.length === 0 ? (
        <EmptyState
          title="Sin productos"
          subtitle="Crea un producto o ajusta el filtro de busqueda."
        />
      ) : null}

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => `${item.externalId || item.id}`}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const productKey = getProductKey(item);
          const rowDeleting = deletingProductKey === productKey;
          const stock = Number(item.stockCajas) || 0;
          return (
            <SectionCard>
              <View style={styles.productTopRow}>
                <View style={styles.productInfo}>
                  <View style={styles.productTitleRow}>
                    <Text style={styles.productName}>{item.nombre}</Text>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>
                        {item.categoria || "Sin categoria"}
                      </Text>
                    </View>
                  </View>
                  {item.descripcion ? (
                    <Text style={styles.productMeta} numberOfLines={2}>
                      {item.descripcion}
                    </Text>
                  ) : null}
                  <View style={styles.stockHighlight}>
                    <Ionicons name="cube-outline" size={13} color={theme.colors.primaryStrong} />
                    <Text style={styles.stockHighlightText}>Stock cajas: {stock}</Text>
                  </View>
                  <Text style={styles.productMetaId}>
                    ID: {item.externalId || item.id || "--"}
                  </Text>
                </View>
                {item.imagen ? (
                  <Image source={{ uri: item.imagen }} style={styles.productImage} />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Ionicons
                      name="image-outline"
                      size={18}
                      color={theme.colors.textMuted}
                    />
                  </View>
                )}
              </View>

              <View style={styles.pricesRow}>
                <View style={styles.priceCard}>
                  <Text style={styles.priceLabel}>Caja</Text>
                  <Text style={styles.priceText}>{formatCurrencyCOP(item.precioCaja)}</Text>
                </View>
                <View style={styles.priceCard}>
                  <Text style={styles.priceLabel}>Sobre</Text>
                  <Text style={styles.priceText}>{formatCurrencyCOP(item.precioSobre)}</Text>
                </View>
                <View style={styles.priceCard}>
                  <Text style={styles.priceLabel}>Unidad</Text>
                  <Text style={styles.priceText}>{formatCurrencyCOP(item.precioUnidad)}</Text>
                </View>
              </View>

              {item.ofertaActiva ? (
                <View style={styles.offerBanner}>
                  <Ionicons
                    name="pricetag-outline"
                    size={13}
                    color={theme.colors.warning}
                  />
                  <Text style={styles.offerBannerText}>
                    Oferta activa {item.ofertaTexto ? `- ${item.ofertaTexto}` : ""}
                  </Text>
                </View>
              ) : null}

              <View style={styles.statusRow}>
                <StatusBadge
                  text={item.disponibilidad || "disponible"}
                  tone={stock > 0 ? "success" : "danger"}
                />
                {stock <= 0 ? <StatusBadge text="sin stock" tone="danger" /> : null}
                {stock > 0 && stock <= LOW_STOCK_LIMIT ? (
                  <StatusBadge text="stock bajo" tone="warning" />
                ) : null}
              </View>
              <View style={styles.actionsRow}>
                <View style={styles.actionItem}>
                  <ActionButton
                    label="Editar"
                    variant="secondary"
                    onPress={() => openEditModal(item)}
                    disabled={!!deletingProductKey}
                  />
                </View>
                <View style={styles.actionItem}>
                  <ActionButton
                    label="Eliminar"
                    variant="danger"
                    onPress={() => onDeleteProduct(item)}
                    loading={rowDeleting}
                    disabled={!!deletingProductKey && !rowDeleting}
                  />
                </View>
              </View>
            </SectionCard>
          );
        }}
      />

      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <ScreenContainer>
          <SectionCard title={editingProduct ? "Editar producto" : "Nuevo producto"}>
            <FormField label="Nombre *" value={form.nombre} onChangeText={(value) => updateForm("nombre", value)} />
            <FormField
              label="Descripcion"
              value={form.descripcion}
              onChangeText={(value) => updateForm("descripcion", value)}
              multiline
            />
            <FormField
              label="Categoria"
              value={form.categoria}
              onChangeText={(value) => updateForm("categoria", value)}
            />
            <FormField
              label="Disponibilidad"
              value={form.disponibilidad}
              onChangeText={(value) => updateForm("disponibilidad", value)}
            />
            <FormField
              label="URL imagen"
              value={form.imagen}
              onChangeText={(value) => updateForm("imagen", value)}
            />
            <FormField
              label="Precio caja"
              value={form.precioCaja}
              onChangeText={(value) => updateForm("precioCaja", value)}
              keyboardType="numeric"
            />
            <FormField
              label="Precio sobre"
              value={form.precioSobre}
              onChangeText={(value) => updateForm("precioSobre", value)}
              keyboardType="numeric"
            />
            <FormField
              label="Precio unidad"
              value={form.precioUnidad}
              onChangeText={(value) => updateForm("precioUnidad", value)}
              keyboardType="numeric"
            />
            <FormField
              label="Sobres por caja"
              value={form.sobresXCaja}
              onChangeText={(value) => updateForm("sobresXCaja", value)}
              keyboardType="numeric"
            />
            <FormField
              label="Unidades por sobre"
              value={form.unidadesXSobre}
              onChangeText={(value) => updateForm("unidadesXSobre", value)}
              keyboardType="numeric"
            />
            <FormField
              label="Stock cajas"
              value={form.stockCajas}
              onChangeText={(value) => updateForm("stockCajas", value)}
              keyboardType="numeric"
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Oferta activa</Text>
              <Switch
                value={form.ofertaActiva}
                onValueChange={(value) => updateForm("ofertaActiva", value)}
              />
            </View>
            <FormField
              label="Texto oferta"
              value={form.ofertaTexto}
              onChangeText={(value) => updateForm("ofertaTexto", value)}
            />
            <FormField
              label="Oferta precio caja"
              value={form.ofertaPrecioCaja}
              onChangeText={(value) => updateForm("ofertaPrecioCaja", value)}
              keyboardType="numeric"
            />
            <FormField
              label="Oferta precio sobre"
              value={form.ofertaPrecioSobre}
              onChangeText={(value) => updateForm("ofertaPrecioSobre", value)}
              keyboardType="numeric"
            />

            <View style={styles.actionsRow}>
              <View style={styles.actionItem}>
                <ActionButton
                  label="Cancelar"
                  variant="secondary"
                  onPress={closeModal}
                  disabled={saving || !!deletingProductKey}
                />
              </View>
              <View style={styles.actionItem}>
                <ActionButton
                  label={editingProduct ? "Actualizar" : "Guardar"}
                  onPress={() => void onSaveProduct()}
                  loading={saving}
                  disabled={!!deletingProductKey}
                />
              </View>
            </View>
          </SectionCard>
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricItem: {
    flex: 1,
    minWidth: 110,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: "#991b1b",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    borderRadius: theme.radius.sm,
    padding: 8,
  },
  productTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  productInfo: {
    flex: 1,
    gap: 6,
  },
  productTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  productName: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  productMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  categoryPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(33,128,141,0.28)",
    backgroundColor: "rgba(33,128,141,0.1)",
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  categoryPillText: {
    color: theme.colors.primaryStrong,
    fontWeight: "800",
    fontSize: 11,
  },
  stockHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  stockHighlightText: {
    color: theme.colors.primaryStrong,
    fontWeight: "800",
    fontSize: 12,
  },
  productImage: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(94,82,64,0.2)",
  },
  productImagePlaceholder: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(94,82,64,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  pricesRow: {
    flexDirection: "row",
    gap: 8,
  },
  priceCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 2,
  },
  priceLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  priceText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  offerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    backgroundColor: "rgba(245,158,11,0.08)",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  offerBannerText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  sectionActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  sectionActionItem: {
    flex: 1,
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
  actionItem: {
    flex: 1,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchLabel: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  categoryFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  filterSummaryText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  clearFilterButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearFilterButtonText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  categoryChipActive: {
    backgroundColor: "rgba(33,128,141,0.15)",
    borderColor: "rgba(33,128,141,0.35)",
  },
  categoryChipText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: theme.colors.primaryStrong,
  },
  productMetaId: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
});
