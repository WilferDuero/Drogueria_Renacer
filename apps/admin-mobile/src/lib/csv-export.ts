import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const CSV_DELIMITER = ";";

const escapeCsv = (value: unknown, delimiter = CSV_DELIMITER) => {
  let text = String(value ?? "");
  if (text.includes('"')) {
    text = text.replace(/"/g, '""');
  }
  const requiresQuotes = new RegExp(`[\"\\n\\r${delimiter}]`).test(text);
  return requiresQuotes ? `"${text}"` : text;
};

export const buildCsvText = (rows: Array<Array<unknown>>, delimiter = CSV_DELIMITER) => {
  const body = rows.map((row) => row.map((cell) => escapeCsv(cell, delimiter)).join(delimiter)).join("\n");
  return `sep=${delimiter}\n${body}`;
};

export const exportCsvFile = async (filename: string, rows: Array<Array<unknown>>) => {
  const dir = FileSystem.cacheDirectory;
  if (!dir) {
    throw new Error("No se pudo acceder al almacenamiento temporal.");
  }

  const csvText = buildCsvText(rows);
  const uri = `${dir}${filename}`;

  // BOM helps Excel/Sheets detect UTF-8 correctly.
  await FileSystem.writeAsStringAsync(uri, `\uFEFF${csvText}`, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Compartir archivos no esta disponible en este dispositivo.");
  }

  await Sharing.shareAsync(uri, {
    dialogTitle: "Exportar CSV",
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
  });

  return uri;
};
