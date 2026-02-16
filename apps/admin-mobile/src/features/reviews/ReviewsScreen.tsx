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
import { clearReviews, listReviews } from "../../api/modules/reviews";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionCard } from "../../components/SectionCard";
import { EmptyState } from "../../components/EmptyState";
import { ActionButton } from "../../components/ActionButton";
import { KpiCard } from "../../components/KpiCard";
import { StatusBadge } from "../../components/StatusBadge";
import { FormField } from "../../components/FormField";
import { theme } from "../../constants/theme";
import { useSyncStore } from "../../store/sync-store";
import { useAuthStore } from "../../store/auth-store";
import { UserRole } from "../../types/domain";
import { formatDateTime } from "../../lib/format";

export const ReviewsScreen = () => {
  const role = useAuthStore((state) => (state.user?.role || "staff") as UserRole);
  const syncTick = useSyncStore((state) => state.syncTick);
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof listReviews>>>([]);
  const [loading, setLoading] = useState(true);
  const [clearingReviews, setClearingReviews] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const isOperationLocked = clearingReviews;

  const loadReviewsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listReviews();
      setReviews(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible cargar resenas.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReviewsData();
  }, [loadReviewsData, syncTick]);

  const sortedReviews = useMemo(
    () =>
      [...reviews].sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      ),
    [reviews]
  );

  const filteredReviews = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return sortedReviews;
    }
    return sortedReviews.filter((review) =>
      [review.nombre, review.telefono, review.texto].join(" ").toLowerCase().includes(term)
    );
  }, [sortedReviews, query]);

  const hasSearchQuery = query.trim().length > 0;

  const reviewStats = useMemo(() => {
    const total = reviews.length;
    const verified = reviews.filter((review) => !!review.verificada).length;
    const avgRating = total
      ? reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / total
      : 0;
    return { total, verified, avgRating };
  }, [reviews]);

  const onClearReviews = () => {
    if (clearingReviews) {
      return;
    }
    Alert.alert("Eliminar resenas", "Esta accion borra todas las resenas (solo owner).", [
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
                  setClearingReviews(true);
                  try {
                    await clearReviews();
                    await loadReviewsData();
                  } catch (e) {
                    const message = e instanceof Error ? e.message : "No fue posible borrar resenas.";
                    Alert.alert("Error", message);
                  } finally {
                    setClearingReviews(false);
                  }
                },
              },
            ]
          );
        },
      },
    ]);
  };

  const onRefreshReviews = useCallback(async () => {
    if (isOperationLocked || refreshing) {
      return;
    }
    setRefreshing(true);
    try {
      await loadReviewsData();
    } finally {
      setRefreshing(false);
    }
  }, [isOperationLocked, loadReviewsData, refreshing]);

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={() => void onRefreshReviews()}>
      <SectionCard title="Resenas de clientes">
        <Text style={styles.subtle}>Consulta feedback recibido en la tienda.</Text>
        <View style={styles.statsRow}>
          <View style={styles.statsItem}>
            <KpiCard
              label="Total Resenas"
              value={String(reviewStats.total)}
              icon="chatbubble-ellipses-outline"
              tone="primary"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Calificacion Prom."
              value={reviewStats.avgRating.toFixed(1)}
              icon="star-outline"
              tone="warning"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Verificadas"
              value={String(reviewStats.verified)}
              icon="checkmark-done-outline"
              tone="success"
              compact
            />
          </View>
        </View>
        {role === "owner" ? (
          <ActionButton
            label="Borrar resenas (owner)"
            variant="danger"
            onPress={onClearReviews}
            loading={clearingReviews}
          />
        ) : null}
        {clearingReviews ? (
          <View style={styles.pendingActionBar}>
            <ActivityIndicator color={theme.colors.primaryStrong} size="small" />
            <Text style={styles.pendingActionText}>Eliminando resenas...</Text>
          </View>
        ) : null}
        <FormField
          label="Buscar resena"
          value={query}
          onChangeText={setQuery}
          placeholder="Nombre, telefono o comentario"
          editable={!isOperationLocked}
        />
        <View style={styles.searchSummaryRow}>
          <Text style={styles.subtle}>Mostrando {filteredReviews.length} resenas</Text>
          {hasSearchQuery ? (
            <Pressable
              style={[styles.clearSearchButton, isOperationLocked && styles.controlDisabled]}
              onPress={() => setQuery("")}
              disabled={isOperationLocked}
            >
              <Text style={styles.clearSearchButtonText}>Limpiar busqueda</Text>
            </Pressable>
          ) : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SectionCard>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.subtle}>Cargando resenas...</Text>
        </View>
      ) : null}

      {!loading && filteredReviews.length === 0 ? (
        <EmptyState
          title="Sin resenas"
          subtitle={
            hasSearchQuery
              ? "No hay resenas que coincidan con la busqueda."
              : "No hay resenas para mostrar."
          }
        />
      ) : null}

      <FlatList
        data={filteredReviews}
        keyExtractor={(item, idx) => `${item.id || `review-${idx}`}`}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <SectionCard>
            <View style={styles.reviewTopRow}>
              <View style={styles.reviewInfo}>
                <View style={styles.reviewNameRow}>
                  <Ionicons
                    name="person-circle-outline"
                    size={18}
                    color={theme.colors.primaryStrong}
                  />
                  <Text style={styles.reviewName}>{item.nombre || "Cliente"}</Text>
                </View>
                <Text style={styles.reviewMeta}>Telefono: {item.telefono || "--"}</Text>
                <Text style={styles.reviewMeta}>Fecha: {formatDateTime(item.createdAt)}</Text>
              </View>
              <View style={styles.reviewBadges}>
                <StatusBadge text={`${Number(item.rating) || 0}/5`} tone="warning" />
                <StatusBadge
                  text={item.verificada ? "verificada" : "sin verificar"}
                  tone={item.verificada ? "success" : "neutral"}
                />
              </View>
            </View>
            <View style={styles.reviewTextCard}>
              <Text style={styles.reviewText}>{item.texto || "(Sin comentario)"}</Text>
            </View>
          </SectionCard>
        )}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  subtle: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statsItem: {
    flex: 1,
    minWidth: 110,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  reviewName: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 14,
  },
  reviewTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  reviewInfo: {
    flex: 1,
    gap: 4,
  },
  reviewNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewBadges: {
    gap: 6,
    alignItems: "flex-end",
  },
  reviewMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  reviewTextCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    padding: 10,
  },
  reviewText: {
    color: theme.colors.text,
    fontSize: 13,
  },
});
