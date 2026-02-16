import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "dr_admin_token_v1";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "drogueria-renacer-admin",
};

export const tokenStorage = {
  async get() {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY, OPTIONS);
    } catch {
      return null;
    }
  },
  async set(token: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token, OPTIONS);
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKEN_KEY, OPTIONS);
  },
};

