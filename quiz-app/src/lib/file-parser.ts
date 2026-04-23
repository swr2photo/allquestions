import mammoth from "mammoth";
import * as xlsx from "xlsx";

export async function parseBase64File(base64Data: string, mimeType: string, filename: string): Promise<string> {
  try {
    const base64 = base64Data.includes("base64,") ? base64Data.split("base64,")[1] : base64Data;
    const buffer = Buffer.from(base64, "base64");

    if (mimeType.includes("pdf") || filename.toLowerCase().endsWith(".pdf")) {
      // Use dynamic import with any cast to avoid type conflicts with pdf-parse ESM/CJS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule = await import("pdf-parse") as any;
      const pdf = pdfParseModule.default || pdfParseModule;
      const data = await pdf(buffer);
      return data.text;
    } 
    
    if (mimeType.includes("wordprocessingml") || filename.toLowerCase().endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    if (mimeType.includes("spreadsheetml") || mimeType.includes("excel") || filename.toLowerCase().endsWith(".xlsx") || filename.toLowerCase().endsWith(".xls") || filename.toLowerCase().endsWith(".csv")) {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      let text = "";
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += `\n--- Sheet: ${sheetName} ---\n`;
        text += xlsx.utils.sheet_to_csv(sheet);
      });
      return text;
    }

    // Text formats
    if (mimeType.includes("text") || mimeType.includes("json") || filename.toLowerCase().endsWith(".txt") || filename.toLowerCase().endsWith(".md")) {
      return buffer.toString("utf-8");
    }

    return `[Attached file: ${filename} (Unsupported format for text extraction)]`;
  } catch (error) {
    console.error(`Error parsing file ${filename}:`, error);
    return `[Failed to parse file: ${filename}]`;
  }
}
