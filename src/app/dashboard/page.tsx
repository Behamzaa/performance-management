"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { Kpi, Project, ImportSnapshot, BlockSummary } from "@/lib/types";
import {
  computeHealthScore,
  computeBlockSummaries,
  getOffTrackKpis,
  getKpiStatusForDisplay,
  formatKpiValue,
  getCurrentTarget,
  getCurrentActual,
} from "@/lib/kpi-status";
import { AlertTriangle, ArrowRight, TrendingUp, CheckCircle2, BarChart3 } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastImport, setLastImport] = useState<ImportSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();

    async function fetchData() {
      const [kpiRes, projectRes, snapshotRes] = await Promise.all([
        supabase.from("kpis").select("*").order("sort_order"),
        supabase.from("projects").select("*").order("sort_order"),
        supabase.from("import_snapshots").select("*").order("imported_at", { ascending: false }).limit(1),
      ]);

      if (kpiRes.data) setKpis(kpiRes.data);
      if (projectRes.data) setProjects(projectRes.data);
      if (snapshotRes.data && snapshotRes.data.length > 0) setLastImport(snapshotRes.data[0]);
      setLoading(false);
    }

    fetchData();
  }, []);

  const healthScore = computeHealthScore(kpis);
  const blockSummaries = computeBlockSummaries(kpis);
  const offTrackKpis = getOffTrackKpis(kpis);
  const onTrackCount = kpis.filter((k) => !k.sub_label && getKpiStatusForDisplay(k).status === "green").length;
  const completedProjects = projects.filter((p) => {
    const months = ["status_jan", "status_feb", "status_mar", "status_apr", "status_may", "status_jun"] as const;
    return months.some((m) => (p[m as keyof Project] as string)?.toUpperCase() === "Y");
  }).length;

  const isEmpty = kpis.length === 0 && projects.length === 0;

  function getScoreColor(score: number) {
    if (score >= 70) return "#00A082";
    if (score >= 40) return "#FFC244";
    return "#EF4444";
  }

  function renderHealthRing(score: number, size: number) {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = getScoreColor(score);

    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Last import banner */}
        {lastImport && (
          <div className="mb-4 text-sm text-gray-500 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[#00A082]" />
            Dernière importation : {lastImport.filename} — {new Date(lastImport.imported_at).toLocaleDateString("fr-FR")} à{" "}
            {new Date(lastImport.imported_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00A082] border-t-transparent" />
          </div>
        ) : isEmpty ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">Aucune donnée disponible</h2>
            <p className="text-gray-500 mb-6">Importez un fichier Excel pour commencer le suivi de vos KPIs et projets.</p>
            <button
              onClick={() => router.push("/import")}
              className="px-6 py-2.5 bg-[#00A082] hover:bg-[#008a6e] text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Importer des données
            </button>
          </div>
        ) : (
          <>
            {/* Top stats row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Health Score */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-5">
                <div className="relative">
                  {renderHealthRing(healthScore, 80)}
                  <span
                    className="absolute inset-0 flex items-center justify-center text-xl font-bold"
                    style={{ color: getScoreColor(healthScore) }}
                  >
                    {healthScore}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Health Score</p>
                  <p className="text-2xl font-bold text-[#1A1A1A]">{healthScore}%</p>
                </div>
              </div>

              {/* KPIs on track */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-[#00A082]" />
                  <p className="text-sm text-gray-500">KPIs on Track</p>
                </div>
                <p className="text-2xl font-bold text-[#1A1A1A]">
                  {onTrackCount}
                  <span className="text-base font-normal text-gray-400"> / {kpis.filter((k) => !k.sub_label).length}</span>
                </p>
              </div>

              {/* Projects completed */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={16} className="text-[#00A082]" />
                  <p className="text-sm text-gray-500">Projets complétés</p>
                </div>
                <p className="text-2xl font-bold text-[#1A1A1A]">
                  {completedProjects}
                  <span className="text-base font-normal text-gray-400"> / {projects.length}</span>
                </p>
              </div>
            </div>

            {/* Block cards grid */}
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Par bloc</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {blockSummaries.map((block) => (
                <button
                  key={block.block}
                  onClick={() => router.push(`/kpis?block=${encodeURIComponent(block.block)}`)}
                  className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:border-[#00A082]/40 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#1A1A1A]">{block.block}</h3>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-[#00A082] transition-colors" />
                  </div>

                  {/* Health bar */}
                  <div className="w-full h-2 bg-gray-100 rounded-full mb-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${block.healthPct}%`,
                        backgroundColor: getScoreColor(block.healthPct),
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-3 text-xs mb-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#00A082]" />
                      {block.green}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#FFC244]" />
                      {block.amber}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      {block.red}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                      {block.nodata}
                    </span>
                  </div>

                  {block.topAlert && (
                    <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded mt-1 truncate">
                      <AlertTriangle size={10} className="inline mr-1" />
                      {block.topAlert.name} ({(block.topAlert.deviation * 100).toFixed(1)}%)
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Top 5 Alerts */}
            {offTrackKpis.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Top 5 Alertes</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">KPI</th>
                        <th className="pb-2 font-medium">Bloc</th>
                        <th className="pb-2 font-medium">Owner</th>
                        <th className="pb-2 font-medium text-right">Target</th>
                        <th className="pb-2 font-medium text-right">Actual</th>
                        <th className="pb-2 font-medium text-right">Déviation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offTrackKpis.slice(0, 5).map((kpi, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: kpi.status === "red" ? "#EF4444" : "#FFC244" }}
                            />
                          </td>
                          <td className="py-2.5 font-medium text-[#1A1A1A]">{kpi.name}</td>
                          <td className="py-2.5 text-gray-500">{kpi.block}</td>
                          <td className="py-2.5 text-gray-500">{kpi.owner || "—"}</td>
                          <td className="py-2.5 text-right text-gray-500">{kpi.target !== null ? kpi.target.toLocaleString() : "—"}</td>
                          <td className="py-2.5 text-right text-gray-500">{kpi.actual !== null ? kpi.actual.toLocaleString() : "—"}</td>
                          <td className="py-2.5 text-right font-medium" style={{ color: kpi.status === "red" ? "#EF4444" : "#FFC244" }}>
                            {kpi.deviation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
