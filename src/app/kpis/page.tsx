"use client";

import { Suspense, useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { Kpi, BLOCK_ORDER, KpiStatus, MONTHS, Month } from "@/lib/types";
import {
  getKpiStatusForDisplay,
  formatKpiValue,
  getCurrentTarget,
  getCurrentActual,
  getCurrentMonth,
  computeKpiStatus,
} from "@/lib/kpi-status";
import { ExternalLink, ChevronDown, ChevronRight, Filter, Calendar, BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, EyeOff, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<KpiStatus, string> = {
  green: "#00A082",
  amber: "#FFC244",
  red: "#EF4444",
  nodata: "#D1D5DB",
};

const STATUS_BG: Record<KpiStatus, string> = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  nodata: "bg-gray-50 text-gray-400",
};

const MONTH_LABELS: Record<Month, string> = {
  jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun",
};

// Map weeks to months (approx): W1-4=Jan, W5-8=Feb, W9-13=Mar, W14-17=Apr, W18-21=May, W22-26=Jun
const WEEK_TO_MONTH: Record<number, Month> = {};
for (let w = 1; w <= 4; w++) WEEK_TO_MONTH[w] = "jan";
for (let w = 5; w <= 8; w++) WEEK_TO_MONTH[w] = "feb";
for (let w = 9; w <= 13; w++) WEEK_TO_MONTH[w] = "mar";
for (let w = 14; w <= 17; w++) WEEK_TO_MONTH[w] = "apr";
for (let w = 18; w <= 21; w++) WEEK_TO_MONTH[w] = "may";
for (let w = 22; w <= 26; w++) WEEK_TO_MONTH[w] = "jun";

type ViewMode = "monthly" | "weekly";

export default function KpisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F5F5]">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00A082] border-t-transparent" />
        </div>
      </div>
    }>
      <KpisContent />
    </Suspense>
  );
}

function StatusDot({ status }: { status: KpiStatus }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
      style={{ backgroundColor: STATUS_COLORS[status] }}
    />
  );
}

function CellValue({ value, format, status }: { value: number | null; format: string; status?: KpiStatus }) {
  const formatted = formatKpiValue(value, format);
  return (
    <span className={cn(
      "tabular-nums text-xs",
      status === "green" && "text-emerald-600",
      status === "amber" && "text-amber-600",
      status === "red" && "text-red-600",
      !status && "text-gray-600",
    )}>
      {formatted}
    </span>
  );
}

function KpisContent() {
  const searchParams = useSearchParams();
  const initialBlock = searchParams.get("block") || "All";

  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockFilter, setBlockFilter] = useState(initialBlock);
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | KpiStatus>("All");
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const [hiddenKpis, setHiddenKpis] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  const currentMonth = getCurrentMonth();

  // Only show months up to and including current month
  const visibleMonths = useMemo(() => {
    const monthOrder: Month[] = ["jan", "feb", "mar", "apr", "may", "jun"];
    const idx = monthOrder.indexOf(currentMonth);
    return monthOrder.slice(0, idx + 1);
  }, [currentMonth]);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }

    // Fetch KPIs and hidden KPIs in parallel
    Promise.all([
      getSupabase()
        .from("kpis")
        .select("*")
        .order("sort_order"),
      fetch("/api/hidden-kpis").then((res) => res.json()),
    ]).then(([kpiResult, hiddenIds]) => {
      if (kpiResult.data) setKpis(kpiResult.data);
      if (Array.isArray(hiddenIds)) {
        setHiddenKpis(new Set(hiddenIds));
      }
      setLoading(false);
    });
  }, []);

  const owners = useMemo(() => {
    const set = new Set(kpis.map((k) => k.owner).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [kpis]);

  const blocks = useMemo(() => {
    const set = new Set(kpis.map((k) => k.block));
    return BLOCK_ORDER.filter((b) => set.has(b));
  }, [kpis]);

  const toggleHideKpi = useCallback((id: string) => {
    setHiddenKpis((prev) => {
      const wasHidden = prev.has(id);
      const next = new Set(prev);
      if (wasHidden) {
        next.delete(id);
      } else {
        next.add(id);
      }

      // Persist to Supabase in the background
      fetch("/api/hidden-kpis", {
        method: wasHidden ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpi_id: id }),
      });

      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    return kpis.filter((kpi) => {
      if (!showHidden && hiddenKpis.has(kpi.id)) return false;
      if (blockFilter !== "All" && kpi.block !== blockFilter) return false;
      if (ownerFilter !== "All" && kpi.owner !== ownerFilter) return false;
      if (statusFilter !== "All") {
        const result = getKpiStatusForDisplay(kpi);
        if (result.status !== statusFilter) return false;
      }
      return true;
    });
  }, [kpis, blockFilter, ownerFilter, statusFilter, hiddenKpis, showHidden]);

  const groupedByBlock = useMemo(() => {
    const map = new Map<string, Kpi[]>();
    for (const kpi of filtered) {
      const existing = map.get(kpi.block) || [];
      existing.push(kpi);
      map.set(kpi.block, existing);
    }
    return map;
  }, [filtered]);

  const toggleBlock = useCallback((block: string) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(block)) next.delete(block); else next.add(block);
      return next;
    });
  }, []);

  // Helper: get weekly value for a KPI
  function getWeeklyValue(kpi: Kpi, week: number): number | null {
    const entry = kpi.weekly_actuals?.find((w) => w.week === week);
    return entry?.value ?? null;
  }

  // Helper: get target for a given week (uses the month's target)
  function getWeekTarget(kpi: Kpi, week: number): number | null {
    const month = WEEK_TO_MONTH[week];
    if (!month) return null;
    return getCurrentTarget(kpi, month);
  }

  // Helper: compute status for a weekly value against its month's target
  function getWeekStatus(kpi: Kpi, week: number): KpiStatus {
    if (kpi.raw_values && Object.keys(kpi.raw_values).length > 0) return "nodata";
    const actual = getWeeklyValue(kpi, week);
    const target = getWeekTarget(kpi, week);
    return computeKpiStatus(actual, target, kpi.lower_is_better).status;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />
      <main className="max-w-[100rem] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-[#1A1A1A]">KPI Board</h1>

          {/* View toggle */}
          <div className="flex bg-white rounded-xl border border-gray-200 p-1">
            <button
              onClick={() => setViewMode("monthly")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                viewMode === "monthly"
                  ? "bg-[#00A082] text-white"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Calendar size={14} />
              Monthly
            </button>
            <button
              onClick={() => setViewMode("weekly")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                viewMode === "weekly"
                  ? "bg-[#00A082] text-white"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <BarChart3 size={14} />
              Weekly
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-3">
          <Filter size={14} className="text-gray-400" />
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A082]"
          >
            <option value="All">All blocks</option>
            {blocks.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A082]"
          >
            <option value="All">All owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "All" | KpiStatus)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A082]"
          >
            <option value="All">All statuses</option>
            <option value="green">On Track</option>
            <option value="amber">At Risk</option>
            <option value="red">Off Track</option>
            <option value="nodata">No Data</option>
          </select>
          {hiddenKpis.size > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
                showHidden
                  ? "bg-gray-100 border-gray-300 text-gray-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              {showHidden ? <Eye size={12} /> : <EyeOff size={12} />}
              {hiddenKpis.size} hidden
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} KPIs</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00A082] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
            No KPIs found with these filters.
          </div>
        ) : viewMode === "monthly" ? (
          <MonthlyView
            blocks={blocks}
            groupedByBlock={groupedByBlock}
            collapsedBlocks={collapsedBlocks}
            toggleBlock={toggleBlock}
            currentMonth={currentMonth}
            visibleMonths={visibleMonths}
            hiddenKpis={hiddenKpis}
            showHidden={showHidden}
            toggleHideKpi={toggleHideKpi}
          />
        ) : (
          <WeeklyView
            blocks={blocks}
            groupedByBlock={groupedByBlock}
            collapsedBlocks={collapsedBlocks}
            toggleBlock={toggleBlock}
            getWeeklyValue={getWeeklyValue}
            getWeekStatus={getWeekStatus}
            currentMonth={currentMonth}
            visibleMonths={visibleMonths}
            hiddenKpis={hiddenKpis}
            showHidden={showHidden}
            toggleHideKpi={toggleHideKpi}
          />
        )}
      </main>
    </div>
  );
}

/* ======================== MONTHLY VIEW ======================== */
function MonthlyView({
  blocks, groupedByBlock, collapsedBlocks, toggleBlock, currentMonth,
  visibleMonths, hiddenKpis, showHidden, toggleHideKpi,
}: {
  blocks: string[];
  groupedByBlock: Map<string, Kpi[]>;
  collapsedBlocks: Set<string>;
  toggleBlock: (b: string) => void;
  currentMonth: Month;
  visibleMonths: Month[];
  hiddenKpis: Set<string>;
  showHidden: boolean;
  toggleHideKpi: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {BLOCK_ORDER.filter((b) => groupedByBlock.has(b)).map((block) => {
        const blockKpis = groupedByBlock.get(block)!;
        const collapsed = collapsedBlocks.has(block);

        return (
          <div key={block} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleBlock(block)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <h2 className="text-sm font-semibold text-[#1A1A1A]">{block}</h2>
                <span className="text-xs text-gray-400">({blockKpis.length})</span>
              </div>
            </button>

            {!collapsed && <BlockSynthesis blockKpis={blockKpis} currentMonth={currentMonth} />}

            {!collapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-t border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-2 font-medium w-6"></th>
                      <th className="px-2 py-2 font-medium w-[220px] max-w-[220px]">KPI</th>
                      <th className="px-2 py-2 font-medium">Owner</th>
                      {visibleMonths.map((m) => (
                        <th key={m} colSpan={2} className={cn(
                          "px-1 py-2 font-semibold text-center border-l border-gray-100",
                          m === currentMonth && "bg-emerald-50/50"
                        )}>
                          {MONTH_LABELS[m]}
                          {m === currentMonth && <span className="ml-1 text-[#00A082]">●</span>}
                        </th>
                      ))}
                      <th className="px-2 py-2 font-medium text-right" title="Actual vs Target for current month">Var</th>
                      <th className="px-2 py-2 font-medium w-14"></th>
                    </tr>
                    <tr className="text-[10px] text-gray-400 border-b border-gray-100 bg-gray-50/30">
                      <th></th>
                      <th></th>
                      <th></th>
                      {visibleMonths.map((m) => (
                        <React.Fragment key={m}>
                          <th className={cn("px-1 py-1 text-center border-l border-gray-100", m === currentMonth && "bg-emerald-50/30")}>Target</th>
                          <th className={cn("px-1 py-1 text-center", m === currentMonth && "bg-emerald-50/30")}>Actual</th>
                        </React.Fragment>
                      ))}
                      <th className="px-1 py-1 text-center text-[9px]">vs Target</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockKpis.map((kpi) => {
                      const isHidden = hiddenKpis.has(kpi.id);
                      const result = getKpiStatusForDisplay(kpi);
                      return (
                        <tr key={kpi.id} className={cn(
                          "border-t border-gray-50 hover:bg-gray-50/50",
                          isHidden && showHidden && "opacity-40"
                        )}>
                          <td className="px-4 py-2"><StatusDot status={result.status} /></td>
                          <td className="px-2 py-2">
                            <span className="font-medium text-[#1A1A1A] text-xs truncate block max-w-[200px]" title={kpi.name}>{kpi.name}</span>
                            {kpi.sub_label && <span className="text-[10px] text-gray-400 ml-1.5">{kpi.sub_label}</span>}
                          </td>
                          <td className="px-2 py-2 text-gray-500 text-xs whitespace-nowrap">{kpi.owner || "—"}</td>
                          {visibleMonths.map((m) => {
                            const target = getCurrentTarget(kpi, m);
                            const actual = getCurrentActual(kpi, m);
                            const monthStatus = computeKpiStatus(actual, target, kpi.lower_is_better);
                            const isCurrentMonth = m === currentMonth;
                            return (
                              <React.Fragment key={m}>
                                <td className={cn(
                                  "px-1 py-2 text-center border-l border-gray-100",
                                  isCurrentMonth && "bg-emerald-50/30"
                                )}>
                                  <CellValue value={target} format={kpi.format} />
                                </td>
                                <td className={cn(
                                  "px-1 py-2 text-center",
                                  isCurrentMonth && "bg-emerald-50/30"
                                )}>
                                  <CellValue value={actual} format={kpi.format} status={actual !== null ? monthStatus.status : undefined} />
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td className="px-2 py-2 text-right">
                            <span className={cn(
                              "text-xs font-semibold",
                              result.status === "green" && "text-emerald-600",
                              result.status === "amber" && "text-amber-600",
                              result.status === "red" && "text-red-600",
                              result.status === "nodata" && "text-gray-400",
                            )}>
                              {result.deviationLabel}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1">
                              {kpi.link && (
                                <a href={kpi.link} target="_blank" rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-[#00A082] transition-colors">
                                  <ExternalLink size={12} />
                                </a>
                              )}
                              <button
                                onClick={() => toggleHideKpi(kpi.id)}
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                                title={isHidden ? "Show KPI" : "Hide KPI"}
                              >
                                {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ======================== WEEKLY VIEW ======================== */
function WeeklyView({
  blocks, groupedByBlock, collapsedBlocks, toggleBlock,
  getWeeklyValue, getWeekStatus, currentMonth,
  visibleMonths, hiddenKpis, showHidden, toggleHideKpi,
}: {
  blocks: string[];
  groupedByBlock: Map<string, Kpi[]>;
  collapsedBlocks: Set<string>;
  toggleBlock: (b: string) => void;
  getWeeklyValue: (kpi: Kpi, week: number) => number | null;
  getWeekStatus: (kpi: Kpi, week: number) => KpiStatus;
  currentMonth: Month;
  visibleMonths: Month[];
  hiddenKpis: Set<string>;
  showHidden: boolean;
  toggleHideKpi: (id: string) => void;
}) {
  // Determine current week (approx: week of year - first week of Jan)
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const currentWeek = Math.min(26, Math.max(1, Math.ceil((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000))));

  // Group weeks by month for headers — only visible months
  const allMonthWeeks: { month: Month; label: string; weeks: number[] }[] = [
    { month: "jan", label: "January", weeks: [1, 2, 3, 4] },
    { month: "feb", label: "February", weeks: [5, 6, 7, 8] },
    { month: "mar", label: "March", weeks: [9, 10, 11, 12, 13] },
    { month: "apr", label: "April", weeks: [14, 15, 16, 17] },
    { month: "may", label: "May", weeks: [18, 19, 20, 21] },
    { month: "jun", label: "June", weeks: [22, 23, 24, 25, 26] },
  ];
  const monthWeeks = allMonthWeeks.filter((mw) => visibleMonths.includes(mw.month));

  return (
    <div className="space-y-4">
      {BLOCK_ORDER.filter((b) => groupedByBlock.has(b)).map((block) => {
        const blockKpis = groupedByBlock.get(block)!;
        const collapsed = collapsedBlocks.has(block);

        return (
          <div key={block} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleBlock(block)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <h2 className="text-sm font-semibold text-[#1A1A1A]">{block}</h2>
                <span className="text-xs text-gray-400">({blockKpis.length})</span>
              </div>
            </button>

            {!collapsed && <BlockSynthesis blockKpis={blockKpis} currentMonth={currentMonth} />}

            {!collapsed && (
              <div className="overflow-x-auto">
                <table className="text-[11px] whitespace-nowrap">
                  {/* Month group header */}
                  <thead>
                    <tr className="border-t border-gray-100 bg-gray-50/70">
                      <th className="px-4 py-1.5 font-medium w-[180px] max-w-[180px] sticky left-0 bg-gray-50/70 z-10" colSpan={2}>KPI</th>
                      <th className="px-2 py-1.5 font-medium sticky left-[180px] bg-gray-50/70 z-10">Owner</th>
                      {monthWeeks.map((mg) => (
                        <th
                          key={mg.month}
                          colSpan={mg.weeks.length + 1}
                          className={cn(
                            "px-1 py-1.5 text-center font-semibold border-l border-gray-200 text-[10px] uppercase tracking-wider",
                            mg.month === currentMonth ? "bg-emerald-50 text-emerald-700" : "text-gray-500"
                          )}
                        >
                          {mg.label}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 w-6"></th>
                    </tr>
                    {/* Sub-header: Target + week numbers */}
                    <tr className="text-[10px] text-gray-400 border-b border-gray-100 bg-gray-50/30">
                      <th className="sticky left-0 bg-gray-50/30 z-10" colSpan={2}></th>
                      <th className="sticky left-[180px] bg-gray-50/30 z-10"></th>
                      {monthWeeks.map((mg) => (
                        <React.Fragment key={mg.month}>
                          <th className={cn(
                            "px-1 py-1 text-center border-l border-gray-200 font-semibold text-[9px]",
                            mg.month === currentMonth ? "bg-emerald-50/50 text-emerald-600" : "text-gray-500"
                          )}>
                            TGT
                          </th>
                          {mg.weeks.map((w) => (
                            <th key={w} className={cn(
                              "px-1 py-1 text-center min-w-[36px]",
                              w === currentWeek && "bg-emerald-100/50 font-bold text-emerald-700",
                              mg.month === currentMonth && w !== currentWeek && "bg-emerald-50/30"
                            )}>
                              W{w}
                            </th>
                          ))}
                        </React.Fragment>
                      ))}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockKpis.map((kpi) => {
                      const isHidden = hiddenKpis.has(kpi.id);
                      const result = getKpiStatusForDisplay(kpi);
                      return (
                        <tr key={kpi.id} className={cn(
                          "border-t border-gray-50 hover:bg-gray-50/50",
                          isHidden && showHidden && "opacity-40"
                        )}>
                          <td className="px-3 py-1.5 sticky left-0 bg-white z-10">
                            <StatusDot status={result.status} />
                          </td>
                          <td className="py-1.5 sticky left-6 bg-white z-10 pr-2">
                            <span className="font-medium text-[#1A1A1A] text-[11px] truncate block max-w-[170px]" title={kpi.name}>{kpi.name}</span>
                            {kpi.sub_label && <span className="text-[9px] text-gray-400 ml-1">{kpi.sub_label}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-gray-500 text-[11px] sticky left-[180px] bg-white z-10">
                            {kpi.owner || "—"}
                          </td>
                          {monthWeeks.map((mg) => {
                            const target = getCurrentTarget(kpi, mg.month);
                            return (
                              <React.Fragment key={mg.month}>
                                <td className={cn(
                                  "px-1 py-1.5 text-center border-l border-gray-200 font-semibold",
                                  mg.month === currentMonth ? "bg-emerald-50/30" : "bg-gray-50/20"
                                )}>
                                  <span className="text-gray-500 text-[10px]">
                                    {formatKpiValue(target, kpi.format)}
                                  </span>
                                </td>
                                {mg.weeks.map((w) => {
                                  const value = getWeeklyValue(kpi, w);
                                  const weekStatus = value !== null ? getWeekStatus(kpi, w) : "nodata";
                                  const isCurrent = w === currentWeek;
                                  return (
                                    <td key={w} className={cn(
                                      "px-1 py-1.5 text-center min-w-[36px]",
                                      isCurrent && "bg-emerald-100/30",
                                      mg.month === currentMonth && !isCurrent && "bg-emerald-50/15"
                                    )}>
                                      {value !== null ? (
                                        <span className={cn(
                                          "text-[10px] tabular-nums",
                                          weekStatus === "green" && "text-emerald-600",
                                          weekStatus === "amber" && "text-amber-600",
                                          weekStatus === "red" && "text-red-600 font-semibold",
                                        )}>
                                          {formatKpiValue(value, kpi.format)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-200 text-[10px]">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              {kpi.link && (
                                <a href={kpi.link} target="_blank" rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-[#00A082] transition-colors">
                                  <ExternalLink size={11} />
                                </a>
                              )}
                              <button
                                onClick={() => toggleHideKpi(kpi.id)}
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                                title={isHidden ? "Show KPI" : "Hide KPI"}
                              >
                                {isHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ======================== BLOCK SYNTHESIS ======================== */
function BlockSynthesis({ blockKpis, currentMonth }: { blockKpis: Kpi[]; currentMonth: Month }) {
  // Only count parent KPIs (not sub-labels)
  const mainKpis = blockKpis.filter((k) => !k.sub_label);

  let green = 0, amber = 0, red = 0, nodata = 0;
  let worstKpi: { name: string; deviation: number; owner: string | null } | null = null;
  let bestKpi: { name: string; deviation: number; owner: string | null } | null = null;

  for (const kpi of mainKpis) {
    const result = getKpiStatusForDisplay(kpi, currentMonth);
    switch (result.status) {
      case "green": green++; break;
      case "amber": amber++; break;
      case "red": red++; break;
      default: nodata++; break;
    }
    if (result.deviation !== null) {
      const absDev = Math.abs(result.deviation);
      if ((result.status === "red" || result.status === "amber") && (!worstKpi || absDev > Math.abs(worstKpi.deviation))) {
        worstKpi = { name: kpi.name, deviation: result.deviation, owner: kpi.owner };
      }
      if (result.status === "green" && result.deviation > 0 && (!bestKpi || result.deviation > bestKpi.deviation)) {
        bestKpi = { name: kpi.name, deviation: result.deviation, owner: kpi.owner };
      }
    }
  }

  const scored = green + amber + red;
  const healthPct = scored > 0 ? Math.round((green / scored) * 100) : 0;
  const total = mainKpis.length;

  return (
    <div className="px-5 py-3 border-t border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
      <div className="flex items-center gap-6 flex-wrap">
        {/* Health score */}
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10">
            <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#E5E7EB" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={healthPct >= 70 ? "#00A082" : healthPct >= 40 ? "#FFC244" : "#EF4444"}
                strokeWidth="3"
                strokeDasharray={`${healthPct * 0.942} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#1A1A1A]">
              {healthPct}%
            </span>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-[#1A1A1A]">Health</div>
            <div className="text-gray-400">{scored}/{total} scored</div>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">{green}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs font-semibold text-amber-700">{amber}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-semibold text-red-700">{red}</span>
          </div>
          {nodata > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-400">{nodata}</span>
            </div>
          )}
        </div>

        {/* Health bar */}
        <div className="flex-1 min-w-[120px] max-w-[200px]">
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
            {scored > 0 && (
              <>
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(green / scored) * 100}%` }} />
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${(amber / scored) * 100}%` }} />
                <div className="h-full bg-red-500 transition-all" style={{ width: `${(red / scored) * 100}%` }} />
              </>
            )}
          </div>
        </div>

        {/* Top alert */}
        {worstKpi && (
          <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-2.5 py-1.5">
            <AlertTriangle size={12} className="text-red-500 shrink-0" />
            <div className="text-[11px]">
              <span className="font-semibold text-red-700">{worstKpi.name}</span>
              <span className="text-red-500 ml-1">
                {worstKpi.deviation >= 0 ? "+" : ""}{(worstKpi.deviation * 100).toFixed(1)}%
              </span>
              {worstKpi.owner && <span className="text-red-400 ml-1">({worstKpi.owner})</span>}
            </div>
          </div>
        )}

        {/* Top performer */}
        {bestKpi && (
          <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg px-2.5 py-1.5">
            <TrendingUp size={12} className="text-emerald-500 shrink-0" />
            <div className="text-[11px]">
              <span className="font-semibold text-emerald-700">{bestKpi.name}</span>
              <span className="text-emerald-500 ml-1">
                +{(bestKpi.deviation * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Need React import for Fragment
import React from "react";
