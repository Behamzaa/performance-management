import { KpiStatus, StatusResult, Kpi, BlockSummary, Month, BLOCK_ORDER, OffTrackKpi } from "./types";

const LOWER_IS_BETTER_KEYWORDS = [
  "DT ",
  "Delivery Time",
  "Fail Rate",
  "Churn",
  "NSO",
  "Outstanding debts",
  "Contact Ratio",
  "Zombie",
  "Free Credits %",
  "CDTP",
  "Cancellations",
];

export function inferLowerIsBetter(name: string): boolean {
  return LOWER_IS_BETTER_KEYWORDS.some((kw) =>
    name.toLowerCase().includes(kw.toLowerCase())
  );
}

export function computeKpiStatus(
  actual: number | null,
  target: number | null,
  lowerIsBetter: boolean
): StatusResult {
  if (actual === null || target === null) {
    return { status: "nodata", deviation: null, deviationLabel: "N/A" };
  }

  if (target === 0) {
    return {
      status: actual >= 0 ? "green" : "red",
      deviation: 0,
      deviationLabel: "0%",
    };
  }

  const deviation = (actual - target) / Math.abs(target);

  let status: KpiStatus;
  if (lowerIsBetter) {
    status = actual <= target ? "green" : deviation > 0.15 ? "red" : "amber";
  } else {
    status = actual >= target ? "green" : deviation < -0.15 ? "red" : "amber";
  }

  return {
    status,
    deviation,
    deviationLabel: `${deviation >= 0 ? "+" : ""}${(deviation * 100).toFixed(1)}%`,
  };
}

export function getCurrentTarget(kpi: Kpi, month?: Month): number | null {
  const m = month || getCurrentMonth();
  const key = `target_${m}` as keyof Kpi;
  const val = kpi[key];
  return typeof val === "number" ? val : null;
}

// Map months to their week ranges
const MONTH_WEEK_RANGES: Record<Month, [number, number]> = {
  jan: [1, 4], feb: [5, 8], mar: [9, 13], apr: [14, 17], may: [18, 21], jun: [22, 26],
};

export function getCurrentActual(kpi: Kpi, month?: Month): number | null {
  const m = month || getCurrentMonth();
  const key = `final_${m}` as keyof Kpi;
  const val = kpi[key];
  if (typeof val === "number") return val;

  // Only fall back to weekly actuals for the current or past months
  const current = getCurrentMonth();
  const monthOrder: Month[] = ["jan", "feb", "mar", "apr", "may", "jun"];
  if (monthOrder.indexOf(m) > monthOrder.indexOf(current)) return null;

  // Fallback: latest weekly actual within this month's week range
  const [startWeek, endWeek] = MONTH_WEEK_RANGES[m];
  const actuals = kpi.weekly_actuals
    .filter((w) => w.value !== null && w.week >= startWeek && w.week <= endWeek)
    .sort((a, b) => b.week - a.week);
  return actuals.length > 0 ? actuals[0].value : null;
}

export function getCurrentMonth(): Month {
  const now = new Date();
  const monthIndex = now.getMonth(); // 0-11
  const monthMap: Record<number, Month> = {
    0: "jan",
    1: "feb",
    2: "mar",
    3: "apr",
    4: "may",
    5: "jun",
  };
  return monthMap[monthIndex] || "mar"; // Default to current period
}

export function getKpiStatusForDisplay(kpi: Kpi, month?: Month): StatusResult {
  if (kpi.raw_values && Object.keys(kpi.raw_values).length > 0) {
    return { status: "nodata", deviation: null, deviationLabel: "Manual" };
  }
  const target = getCurrentTarget(kpi, month);
  const actual = getCurrentActual(kpi, month);
  return computeKpiStatus(actual, target, kpi.lower_is_better);
}

export function computeBlockSummaries(kpis: Kpi[], month?: Month): BlockSummary[] {
  const blockMap = new Map<string, Kpi[]>();
  for (const kpi of kpis) {
    if (!kpi.sub_label) {
      // Only count parent KPIs, not sub-labels
      const existing = blockMap.get(kpi.block) || [];
      existing.push(kpi);
      blockMap.set(kpi.block, existing);
    }
  }

  const summaries: BlockSummary[] = [];

  for (const block of BLOCK_ORDER) {
    const blockKpis = blockMap.get(block);
    if (!blockKpis || blockKpis.length === 0) continue;

    let green = 0,
      amber = 0,
      red = 0,
      nodata = 0;
    let worstDeviation = 0;
    let topAlert: BlockSummary["topAlert"] = null;

    for (const kpi of blockKpis) {
      const result = getKpiStatusForDisplay(kpi, month);
      switch (result.status) {
        case "green":
          green++;
          break;
        case "amber":
          amber++;
          break;
        case "red":
          red++;
          break;
        case "nodata":
          nodata++;
          break;
      }

      if (
        result.deviation !== null &&
        (result.status === "red" || result.status === "amber")
      ) {
        const absDeviation = Math.abs(result.deviation);
        if (absDeviation > worstDeviation) {
          worstDeviation = absDeviation;
          topAlert = {
            name: kpi.name,
            deviation: result.deviation,
            owner: kpi.owner,
          };
        }
      }
    }

    const scored = green + amber + red;
    const healthPct = scored > 0 ? Math.round((green / scored) * 100) : 0;

    summaries.push({
      block,
      total: blockKpis.length,
      green,
      amber,
      red,
      nodata,
      healthPct,
      topAlert,
    });
  }

  return summaries;
}

export function getOffTrackKpis(kpis: Kpi[], month?: Month): OffTrackKpi[] {
  const offTrack: OffTrackKpi[] = [];

  for (const kpi of kpis) {
    if (kpi.sub_label) continue;
    const result = getKpiStatusForDisplay(kpi, month);
    if (result.status === "red" || result.status === "amber") {
      offTrack.push({
        block: kpi.block,
        name: kpi.name,
        target: getCurrentTarget(kpi, month),
        actual: getCurrentActual(kpi, month),
        deviation: result.deviationLabel,
        owner: kpi.owner,
        status: result.status,
      });
    }
  }

  return offTrack.sort((a, b) => {
    const aAbs = Math.abs(parseFloat(a.deviation) || 0);
    const bAbs = Math.abs(parseFloat(b.deviation) || 0);
    return bAbs - aAbs;
  });
}

export function computeHealthScore(kpis: Kpi[], month?: Month): number {
  let green = 0,
    scored = 0;
  for (const kpi of kpis) {
    if (kpi.sub_label) continue;
    const result = getKpiStatusForDisplay(kpi, month);
    if (result.status !== "nodata") {
      scored++;
      if (result.status === "green") green++;
    }
  }
  return scored > 0 ? Math.round((green / scored) * 100) : 0;
}

export function formatKpiValue(value: number | null, format: string): string {
  if (value === null) return "—";
  switch (format) {
    case "pct":
      return `${(value * 100).toFixed(1)}%`;
    case "pct4":
      return `${(value * 100).toFixed(2)}%`;
    case "currency":
      return `€${value.toLocaleString()}`;
    case "num":
    default:
      return value.toLocaleString();
  }
}
