import { NextRequest, NextResponse } from "next/server";
import { parseMasterplan } from "@/lib/excel-parser";
import { getSupabase, isConfigured } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!isConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "An xlsx file is required" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json(
        { error: "File must be an Excel spreadsheet (.xlsx or .xls)" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const { kpis, projects, warnings } = parseMasterplan(buffer);

    const supabase = getSupabase();

    // Create import snapshot record
    const { data: snapshot, error: snapshotError } = await supabase
      .from("import_snapshots")
      .insert({
        filename: file.name,
        kpi_count: kpis.length,
        project_count: projects.length,
        notes: warnings.length > 0 ? warnings.join("; ") : null,
      })
      .select("id")
      .single();

    if (snapshotError || !snapshot) {
      return NextResponse.json(
        { error: "Failed to create import snapshot: " + (snapshotError?.message ?? "Unknown error") },
        { status: 500 }
      );
    }

    const snapshotId = snapshot.id;

    // Delete existing kpis and projects
    const { error: deleteKpisError } = await supabase
      .from("kpis")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

    if (deleteKpisError) {
      return NextResponse.json(
        { error: "Failed to clear existing KPIs: " + deleteKpisError.message },
        { status: 500 }
      );
    }

    const { error: deleteProjectsError } = await supabase
      .from("projects")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

    if (deleteProjectsError) {
      return NextResponse.json(
        { error: "Failed to clear existing projects: " + deleteProjectsError.message },
        { status: 500 }
      );
    }

    // Insert new KPIs with snapshot id
    if (kpis.length > 0) {
      const kpiRows = kpis.map((kpi) => ({
        ...kpi,
        import_snapshot_id: snapshotId,
      }));

      // Insert in batches of 100 to avoid payload limits
      const KPI_BATCH_SIZE = 100;
      for (let i = 0; i < kpiRows.length; i += KPI_BATCH_SIZE) {
        const batch = kpiRows.slice(i, i + KPI_BATCH_SIZE);
        const { error: insertKpiError } = await supabase
          .from("kpis")
          .insert(batch);

        if (insertKpiError) {
          return NextResponse.json(
            { error: "Failed to insert KPIs (batch " + (Math.floor(i / KPI_BATCH_SIZE) + 1) + "): " + insertKpiError.message },
            { status: 500 }
          );
        }
      }
    }

    // Insert new projects with snapshot id
    if (projects.length > 0) {
      const projectRows = projects.map((project) => ({
        ...project,
        import_snapshot_id: snapshotId,
      }));

      const PROJECT_BATCH_SIZE = 100;
      for (let i = 0; i < projectRows.length; i += PROJECT_BATCH_SIZE) {
        const batch = projectRows.slice(i, i + PROJECT_BATCH_SIZE);
        const { error: insertProjectError } = await supabase
          .from("projects")
          .insert(batch);

        if (insertProjectError) {
          return NextResponse.json(
            { error: "Failed to insert projects (batch " + (Math.floor(i / PROJECT_BATCH_SIZE) + 1) + "): " + insertProjectError.message },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      kpiCount: kpis.length,
      projectCount: projects.length,
      warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Import failed: " + message },
      { status: 500 }
    );
  }
}
