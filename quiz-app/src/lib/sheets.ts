import type { SheetRow } from "@/types";

const SHEET_ID = "1-7p30j2PR8oLeyJ02vMq1ut5IZ6iSh8zvMFS50w74Lc";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.trim()) {
        rows.push(parseCSVLine(current));
      }
      current = "";
      // Skip \r\n
      if (char === "\r" && csvText[i + 1] === "\n") i++;
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    rows.push(parseCSVLine(current));
  }
  return rows;
}

export async function fetchSheetData(): Promise<SheetRow[]> {
  try {
    const response = await fetch(CSV_URL, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!response.ok) {
      console.error("Failed to fetch sheet:", response.status);
      return [];
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    // Skip header row
    if (rows.length < 2) return [];

    const data: SheetRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || row.length < 2) continue;

      data.push({
        course: row[0] || "",
        quizTitle: row[1] || "",
        link: row[2] || "",
        description: row[3] || "",
        deadline: row[4] || "",
        status: row[5] || "",
      });
    }

    return data;
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    return [];
  }
}

// Group sheet rows by course name
export function groupByCourse(rows: SheetRow[]): Record<string, SheetRow[]> {
  const grouped: Record<string, SheetRow[]> = {};
  for (const row of rows) {
    if (!grouped[row.course]) {
      grouped[row.course] = [];
    }
    grouped[row.course].push(row);
  }
  return grouped;
}
