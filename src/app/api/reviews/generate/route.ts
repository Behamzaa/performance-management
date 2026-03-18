import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildReviewPrompt } from "@/lib/review-prompt";
import { OffTrackKpi, StalledProject } from "@/lib/types";

const MODEL = "claude-sonnet-4-20250514";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { cadence, period, kpiData, projectData } = body;

    if (!cadence || !period) {
      return NextResponse.json(
        { error: "cadence and period are required" },
        { status: 400 }
      );
    }

    if (!["weekly", "monthly"].includes(cadence)) {
      return NextResponse.json(
        { error: "cadence must be 'weekly' or 'monthly'" },
        { status: 400 }
      );
    }

    // Extract off-track KPIs and stalled projects from the provided data
    const offTrackKpis: OffTrackKpi[] = kpiData?.offTrackKpis ?? [];
    const stalledProjects: StalledProject[] = projectData?.stalledProjects ?? [];
    const healthScore: number = kpiData?.healthScore ?? 0;
    const onTrackCount: number = kpiData?.onTrackCount ?? 0;
    const totalKpis: number = kpiData?.totalKpis ?? 0;
    const completedProjectCount: number = projectData?.completedProjectCount ?? 0;
    const totalProjects: number = projectData?.totalProjects ?? 0;

    const { system, user } = buildReviewPrompt({
      cadence,
      period,
      healthScore,
      offTrackKpis,
      onTrackCount,
      totalKpis,
      stalledProjects,
      completedProjectCount,
      totalProjects,
    });

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    });

    // Extract text from the response
    const narrative = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n\n");

    return NextResponse.json({ narrative, model: MODEL });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate review: " + message },
      { status: 500 }
    );
  }
}
