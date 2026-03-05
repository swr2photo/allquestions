import { NextResponse } from "next/server";
import { fetchSheetData, groupByCourse } from "@/lib/sheets";

export const revalidate = 300; // Revalidate every 5 minutes

export async function GET() {
  try {
    const rows = await fetchSheetData();
    const grouped = groupByCourse(rows);

    return NextResponse.json({
      success: true,
      data: grouped,
      totalRows: rows.length,
      courses: Object.keys(grouped),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch sheet data" },
      { status: 500 }
    );
  }
}
