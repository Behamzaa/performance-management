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

    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch reviews: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ reviews });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch reviews: " + message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      cadence,
      period_label,
      kpi_snapshot,
      project_snapshot,
      off_track_kpis,
      stalled_projects,
      commentary,
      ai_narrative,
      ai_model,
    } = body;

    if (!cadence || !period_label) {
      return NextResponse.json(
        { error: "cadence and period_label are required" },
        { status: 400 }
      );
    }

    if (!["weekly", "monthly"].includes(cadence)) {
      return NextResponse.json(
        { error: "cadence must be 'weekly' or 'monthly'" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: review, error } = await supabase
      .from("reviews")
      .insert({
        cadence,
        period_label,
        kpi_snapshot: kpi_snapshot ?? [],
        project_snapshot: project_snapshot ?? [],
        off_track_kpis: off_track_kpis ?? null,
        stalled_projects: stalled_projects ?? null,
        commentary: commentary ?? null,
        ai_narrative: ai_narrative ?? null,
        ai_model: ai_model ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create review: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create review: " + message },
      { status: 500 }
    );
  }
}
