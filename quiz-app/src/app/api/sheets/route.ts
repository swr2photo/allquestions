import { NextResponse } from "next/server";
import { fetchSheetData, groupByCourse } from "@/lib/sheets";
import { cookies } from "next/headers";
import { isValidSession } from "@/lib/admin-store";

async function requireAdmin() {
  const token = (await cookies()).get("admin-session")?.value;
  return isValidSession(token);
}


export const revalidate = 300; // Revalidate every 5 minutes

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
