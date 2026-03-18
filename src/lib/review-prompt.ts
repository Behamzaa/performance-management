import { OffTrackKpi, StalledProject } from "./types";

const SYSTEM_PROMPT = `You are a business analyst assistant for the GM of Glovo Morocco.
Generate a concise business review narrative from KPI and project data.
Structure your response with these sections:
1. **Executive Summary** (2-3 sentences)
2. **Key Wins** (2-3 bullet points with specific numbers)
3. **Key Risks** (2-3 bullet points with specific numbers and owner names)
4. **Recommended Actions** (2-3 bullet points, actionable and specific)
5. **Projects Update** (brief status on stalled/completed projects)

Tone: Professional, direct, data-driven. Reference specific numbers and percentages.
Length: 300-500 words.
Language: English.`;

export function buildReviewPrompt(data: {
  cadence: "weekly" | "monthly";
  period: string;
  healthScore: number;
  offTrackKpis: OffTrackKpi[];
  onTrackCount: number;
  totalKpis: number;
  stalledProjects: StalledProject[];
  completedProjectCount: number;
  totalProjects: number;
}): { system: string; user: string } {
  const offTrackSection = data.offTrackKpis
    .slice(0, 10)
    .map(
      (k) =>
        `- ${k.block} > ${k.name}: Target=${k.target ?? "N/A"}, Actual=${k.actual ?? "N/A"}, Deviation=${k.deviation}, Owner=${k.owner ?? "N/A"}`
    )
    .join("\n");

  const stalledSection = data.stalledProjects
    .slice(0, 10)
    .map(
      (p) =>
        `- ${p.block} > ${p.name}: Status=${p.status ?? "N/A"}, Owner=${p.owner ?? "N/A"}, Comment=${p.comment ?? "No update"}`
    )
    .join("\n");

  const user = `Generate a ${data.cadence} business review for Glovo Morocco for ${data.period}.

DASHBOARD HEALTH: ${data.healthScore}% of KPIs on track (${data.onTrackCount}/${data.totalKpis} green)
PROJECTS: ${data.completedProjectCount}/${data.totalProjects} completed

OFF-TRACK KPIs (${data.offTrackKpis.length} total):
${offTrackSection || "None"}

STALLED PROJECTS (${data.stalledProjects.length} total):
${stalledSection || "None"}`;

  return { system: SYSTEM_PROMPT, user };
}
