import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isConfigured } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!isConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("month")
      .order("sort_order");

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch milestones: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ milestones: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const body = await req.json();
    const { project_id, month, title } = body;

    if (!project_id || !month || !title) {
      return NextResponse.json(
        { error: "project_id, month, and title are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("milestones")
      .insert({ project_id, month, title })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create milestone: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ milestone: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { id, is_done, title } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof is_done === "boolean") updates.is_done = is_done;
    if (typeof title === "string") updates.title = title;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("milestones")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update milestone: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ milestone: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("milestones")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete milestone: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
