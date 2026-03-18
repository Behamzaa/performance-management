import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("hidden_kpis")
      .select("kpi_id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const kpiIds = (data || []).map((row: { kpi_id: string }) => row.kpi_id);
    return NextResponse.json(kpiIds);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch hidden KPIs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  try {
    const { kpi_id } = await req.json();
    if (!kpi_id) {
      return NextResponse.json(
        { error: "kpi_id is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("hidden_kpis")
      .upsert({ kpi_id }, { onConflict: "kpi_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to hide KPI" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  try {
    const { kpi_id } = await req.json();
    if (!kpi_id) {
      return NextResponse.json(
        { error: "kpi_id is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("hidden_kpis")
      .delete()
      .eq("kpi_id", kpi_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to unhide KPI" },
      { status: 500 }
    );
  }
}
