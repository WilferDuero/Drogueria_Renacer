import { useCallback, useEffect, useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createUser, listUsers, updateUser } from "../../api/modules/users";
import { UserRole, UserSummary } from "../../types/domain";
import { useAuthStore } from "../../store/auth-store";
import { useSyncStore } from "../../store/sync-store";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionCard } from "../../components/SectionCard";
import { EmptyState } from "../../components/EmptyState";
import { FormField } from "../../components/FormField";
import { ActionButton } from "../../components/ActionButton";
import { StatusBadge } from "../../components/StatusBadge";
import { KpiCard } from "../../components/KpiCard";
import { formatDateTime } from "../../lib/format";
import { theme } from "../../constants/theme";

interface CreateUserState {
  username: string;
  password: string;
  role: UserRole;
}

interface EditUserState {
  username: string;
  password: string;
  role: UserRole;
}

const initialCreateForm: CreateUserState = {
  username: "",
  password: "",
  role: "staff",
};

export const UsersScreen = () => {
  const role = useAuthStore((state) => (state.user?.role || "staff") as UserRole);
  const syncTick = useSyncStore((state) => state.syncTick);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserState>(initialCreateForm);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [editForm, setEditForm] = useState<EditUserState>({
    username: "",
    password: "",
    role: "staff",
  });

  const isOwner = role === "owner";

  const loadUsersData = useCallback(async () => {
    if (!isOwner) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listUsers();
      setUsers(list);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible cargar usuarios.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    void loadUsersData();
  }, [loadUsersData, syncTick]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.id - b.id),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sortedUsers.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      return [user.username, user.role, String(user.id)].join(" ").toLowerCase().includes(term);
    });
  }, [sortedUsers, query, roleFilter]);

  const hasUserFilters = query.trim().length > 0 || roleFilter !== "all";

  const userStats = useMemo(() => {
    const total = users.length;
    const owners = users.filter((user) => user.role === "owner").length;
    const staff = users.filter((user) => user.role === "staff").length;
    return { total, owners, staff };
  }, [users]);

  const setCreateRole = (nextRole: UserRole) => {
    setCreateForm((prev) => ({ ...prev, role: nextRole }));
  };

  const setEditRole = (nextRole: UserRole) => {
    setEditForm((prev) => ({ ...prev, role: nextRole }));
  };

  const openEditModal = (user: UserSummary) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      password: "",
      role: user.role,
    });
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm({
      username: "",
      password: "",
      role: "staff",
    });
  };

  const onCreateUser = async () => {
    if (!createForm.username.trim() || !createForm.password.trim()) {
      Alert.alert("Validacion", "Usuario y contrasena son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await createUser({
        username: createForm.username.trim(),
        password: createForm.password.trim(),
        role: createForm.role,
      });
      setCreateForm(initialCreateForm);
      await loadUsersData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "No fue posible crear usuario.";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const onUpdateUser = async () => {
    if (!editingUser) {
      return;
    }
    const payload: {
      username?: string;
      password?: string;
      role?: UserRole;
    } = {};
    const username = editForm.username.trim();
    const password = editForm.password.trim();

    if (username && username !== editingUser.username) {
      payload.username = username;
    }
    if (password) {
      payload.password = password;
    }
    if (editForm.role !== editingUser.role) {
      payload.role = editForm.role;
    }
    if (!Object.keys(payload).length) {
      closeEditModal();
      return;
    }
    const summary: string[] = [];
    if (payload.username) {
      summary.push(`Usuario: ${editingUser.username} -> ${payload.username}`);
    }
    if (payload.role) {
      summary.push(`Rol: ${editingUser.role} -> ${payload.role}`);
    }
    if (payload.password) {
      summary.push("Contrasena: se reemplazara.");
    }
    const riskyRoleDowngrade = editingUser.role === "owner" && payload.role === "staff";

    Alert.alert(
      riskyRoleDowngrade ? "Cambio sensible de rol" : "Confirmar cambios",
      `${summary.join("\n")}\n\n${
        riskyRoleDowngrade
          ? "Advertencia: este usuario perdera permisos owner."
          : "Deseas guardar estos cambios?"
      }`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Guardar",
          onPress: async () => {
            setSaving(true);
            try {
              await updateUser(editingUser.id, payload);
              closeEditModal();
              await loadUsersData();
            } catch (e) {
              const message = e instanceof Error ? e.message : "No fue posible actualizar usuario.";
              Alert.alert("Error", message);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (!isOwner) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Acceso solo owner"
          subtitle="La gestion de usuarios esta restringida al rol owner."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <SectionCard title="Crear usuario">
        <Text style={styles.subtle}>Gestiona accesos del panel admin por rol.</Text>
        <FormField
          label="Usuario"
          value={createForm.username}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, username: value }))}
        />
        <FormField
          label="Contrasena"
          value={createForm.password}
          onChangeText={(value) => setCreateForm((prev) => ({ ...prev, password: value }))}
          secureTextEntry
        />
        <View style={styles.roleRow}>
          <Pressable
            style={[styles.roleButton, createForm.role === "owner" && styles.roleButtonActive]}
            onPress={() => setCreateRole("owner")}
          >
            <Text
              style={[
                styles.roleButtonLabel,
                createForm.role === "owner" && styles.roleButtonLabelActive,
              ]}
            >
              owner
            </Text>
          </Pressable>
          <Pressable
            style={[styles.roleButton, createForm.role === "staff" && styles.roleButtonActive]}
            onPress={() => setCreateRole("staff")}
          >
            <Text
              style={[
                styles.roleButtonLabel,
                createForm.role === "staff" && styles.roleButtonLabelActive,
              ]}
            >
              staff
            </Text>
          </Pressable>
        </View>
        <ActionButton label="Crear usuario" onPress={() => void onCreateUser()} loading={saving} />
      </SectionCard>

      <SectionCard title="Usuarios registrados">
        <View style={styles.statsRow}>
          <View style={styles.statsItem}>
            <KpiCard
              label="Total Usuarios"
              value={String(userStats.total)}
              icon="people-outline"
              tone="primary"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Owners"
              value={String(userStats.owners)}
              icon="shield-checkmark-outline"
              tone="warning"
              compact
            />
          </View>
          <View style={styles.statsItem}>
            <KpiCard
              label="Staff"
              value={String(userStats.staff)}
              icon="person-outline"
              tone="success"
              compact
            />
          </View>
        </View>
        <FormField
          label="Buscar usuario"
          value={query}
          onChangeText={setQuery}
          placeholder="Usuario, rol o ID"
        />
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterButton, roleFilter === "all" && styles.filterButtonActive]}
            onPress={() => setRoleFilter("all")}
          >
            <Text
              style={[
                styles.filterButtonText,
                roleFilter === "all" && styles.filterButtonTextActive,
              ]}
            >
              Todos
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, roleFilter === "owner" && styles.filterButtonActive]}
            onPress={() => setRoleFilter("owner")}
          >
            <Text
              style={[
                styles.filterButtonText,
                roleFilter === "owner" && styles.filterButtonTextActive,
              ]}
            >
              Owner
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, roleFilter === "staff" && styles.filterButtonActive]}
            onPress={() => setRoleFilter("staff")}
          >
            <Text
              style={[
                styles.filterButtonText,
                roleFilter === "staff" && styles.filterButtonTextActive,
              ]}
            >
              Staff
            </Text>
          </Pressable>
        </View>
        <View style={styles.filterSummaryRow}>
          <Text style={styles.subtle}>Mostrando {filteredUsers.length} usuarios</Text>
          {hasUserFilters ? (
            <Pressable
              style={styles.clearFilterButton}
              onPress={() => {
                setQuery("");
                setRoleFilter("all");
              }}
            >
              <Text style={styles.clearFilterButtonText}>Limpiar filtros</Text>
            </Pressable>
          ) : null}
        </View>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.subtle}>Cargando usuarios...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && filteredUsers.length === 0 ? (
          <EmptyState
            title="Sin usuarios"
            subtitle={
              hasUserFilters
                ? "No hay usuarios para los filtros seleccionados."
                : "No hay usuarios para mostrar."
            }
          />
        ) : null}
        {filteredUsers.map((user) => (
          <SectionCard key={user.id}>
            <View style={styles.userTopRow}>
              <View style={styles.userInfo}>
                <View style={styles.userTitleRow}>
                  <Ionicons
                    name="person-circle-outline"
                    size={18}
                    color={theme.colors.primaryStrong}
                  />
                  <Text style={styles.userTitle}>{user.username}</Text>
                </View>
                <View style={styles.userMetaRow}>
                  <View style={styles.userIdPill}>
                    <Text style={styles.userIdPillText}>ID {user.id}</Text>
                  </View>
                  <Text style={styles.subtle}>Creado: {formatDateTime(user.createdAt)}</Text>
                </View>
              </View>
              <StatusBadge
                text={user.role}
                tone={user.role === "owner" ? "warning" : "neutral"}
              />
            </View>
            <ActionButton
              label="Editar usuario"
              variant="secondary"
              onPress={() => openEditModal(user)}
            />
          </SectionCard>
        ))}
      </SectionCard>

      <Modal visible={!!editingUser} animationType="slide" onRequestClose={closeEditModal}>
        <ScreenContainer>
          <SectionCard title={`Editar ${editingUser?.username || ""}`}>
            <FormField
              label="Usuario"
              value={editForm.username}
              onChangeText={(value) => setEditForm((prev) => ({ ...prev, username: value }))}
            />
            <FormField
              label="Nueva contrasena (opcional)"
              value={editForm.password}
              onChangeText={(value) => setEditForm((prev) => ({ ...prev, password: value }))}
              secureTextEntry
            />
            <View style={styles.roleRow}>
              <Pressable
                style={[styles.roleButton, editForm.role === "owner" && styles.roleButtonActive]}
                onPress={() => setEditRole("owner")}
              >
                <Text
                  style={[
                    styles.roleButtonLabel,
                    editForm.role === "owner" && styles.roleButtonLabelActive,
                  ]}
                >
                  owner
                </Text>
              </Pressable>
              <Pressable
                style={[styles.roleButton, editForm.role === "staff" && styles.roleButtonActive]}
                onPress={() => setEditRole("staff")}
              >
                <Text
                  style={[
                    styles.roleButtonLabel,
                    editForm.role === "staff" && styles.roleButtonLabelActive,
                  ]}
                >
                  staff
                </Text>
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <View style={styles.modalAction}>
                <ActionButton label="Cancelar" variant="secondary" onPress={closeEditModal} />
              </View>
              <View style={styles.modalAction}>
                <ActionButton label="Guardar" onPress={() => void onUpdateUser()} loading={saving} />
              </View>
            </View>
          </SectionCard>
        </ScreenContainer>
      </Modal>
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
    borderColor: "rgba(33,128,141,0.4)",
    backgroundColor: "rgba(33,128,141,0.12)",
  },
  filterButtonText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  filterButtonTextActive: {
    color: theme.colors.primaryStrong,
  },
  filterSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  clearFilterButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearFilterButtonText: {
    color: theme.colors.primaryStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
  },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: theme.colors.surface,
  },
  roleButtonActive: {
    borderColor: "rgba(33,128,141,0.4)",
    backgroundColor: "rgba(33,128,141,0.12)",
  },
  roleButtonLabel: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  roleButtonLabelActive: {
    color: theme.colors.primaryStrong,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  error: {
    color: "#991b1b",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: theme.radius.sm,
    borderColor: "rgba(239,68,68,0.25)",
    borderWidth: 1,
    padding: 8,
  },
  userTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 15,
  },
  userTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  userInfo: {
    flex: 1,
    gap: 6,
  },
  userTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  userIdPill: {
    borderWidth: 1,
    borderColor: "rgba(33,128,141,0.3)",
    backgroundColor: "rgba(33,128,141,0.1)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  userIdPillText: {
    color: theme.colors.primaryStrong,
    fontWeight: "800",
    fontSize: 11,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalAction: {
    flex: 1,
  },
});
