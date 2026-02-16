import AsyncStorage from "@react-native-async-storage/async-storage";
import { OrderItem } from "../types/domain";

const ORDER_LEDGER_KEY = "dr_admin_orders_ledger_v1";

export interface OrderLedgerEntry {
  orderKey: string;
  acceptedItems: OrderItem[];
  rejectedItems: OrderItem[];
  totalAccepted: number;
  processedAtISO: string;
  canceledAtISO?: string;
}

type LedgerMap = Record<string, OrderLedgerEntry>;

const readLedgerMap = async (): Promise<LedgerMap> => {
  try {
    const raw = await AsyncStorage.getItem(ORDER_LEDGER_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as LedgerMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeLedgerMap = async (map: LedgerMap) => {
  await AsyncStorage.setItem(ORDER_LEDGER_KEY, JSON.stringify(map));
};

export const getOrderLedgerMap = async () => readLedgerMap();

export const getOrderLedgerEntry = async (orderKey: string) => {
  const map = await readLedgerMap();
  return map[orderKey] || null;
};

export const saveOrderLedgerEntry = async (entry: OrderLedgerEntry) => {
  const map = await readLedgerMap();
  map[entry.orderKey] = entry;
  await writeLedgerMap(map);
};

export const markOrderLedgerCanceled = async (orderKey: string) => {
  const map = await readLedgerMap();
  const existing = map[orderKey];
  if (!existing) {
    return;
  }
  map[orderKey] = {
    ...existing,
    canceledAtISO: new Date().toISOString(),
  };
  await writeLedgerMap(map);
};
