"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { Kpi, Project } from "@/lib/types";
import {
  computeHealthScore,
  getOffTrackKpis,
  getKpiStatusForDisplay,
} from "@/lib/kpi-status";
import { Sparkles, Save, Loader2 } from "lucide-react";

function getDefaultPeriodLabel(cadence: "weekly" | "monthly"): string {
  const now = new Date();
  if (cadence === "weekly") {
    const weekNum = Math.ceil(
      ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
    );
    return `Semaine ${weekNum} — ${now.getFullYear()}`;
  }
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

export default function NewReviewPage() {
  const router = useRouter();
  const [cadence, setCadence] = useState<"weekly" | "monthly">("weekly");
  const [periodLabel, setPeriodLabel] = useState(getDefaultPeriodLabel("weekly"));
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [narrative, setNarrative] = useState("");
  const [commentary, setCommentary] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    Promise.all([
      supabase.from("kpis").select("*").order("sort_order"),
      supabase.from("projects").select("*").order("sort_order"),
    ]).then(([kpiRes, projRes]) => {
      if (kpiRes.data) setKpis(kpiRes.data);
      if (projRes.data) setProjects(projRes.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setPeriodLabel(getDefaultPeriodLabel(cadence));
  }, [cadence]);

  const offTrackKpis = getOffTrackKpis(kpis);
  const healthScore = computeHealthScore(kpis);
  const onTrackCount = kpis.filter((k) => !k.sub_label && getKpiStatusForDisplay(k).status === "green").length;
  const totalKpis = kpis.filter((k) => !k.sub_label).length;

  const stalledProjects = projects.filter((p) => {
    const months = [p.status_jun, p.status_may, p.status_apr, p.status_mar, p.status_feb, p.status_jan];
    const latest = months.find((v) => v !== null);
    return latest && latest.trim().toUpperCase() === "N";
  }).map((p) => {
    const months = [
      { key: "jun", val: p.status_jun, comment: p.comment_jun },
      { key: "may", val: p.status_may, comment: p.comment_may },
      { key: "apr", val: p.status_apr, comment: p.comment_apr },
      { key: "mar", val: p.status_mar, comment: p.comment_mar },
      { key: "feb", val: p.status_feb, comment: p.comment_feb },
      { key: "jan", val: p.status_jan, comment: p.comment_jan },
    ];
    const latest = months.find((m) => m.val !== null);
    return {
      block: p.block,
      name: p.name,
      owner: p.owner,
      status: latest?.val || null,
      comment: latest?.comment || null,
    };
  });

  const completedProjectCount = projects.filter((p) => {
    const months = [p.status_jan, p.status_feb, p.status_mar, p.status_apr, p.status_may, p.status_jun];
    return months.some((v) => v && v.trim().toUpperCase() === "Y");
  }).length;

  async function handleGenerate() {
    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/reviews/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cadence,
          period: periodLabel,
          kpiData: {
            offTrackKpis,
            healthScore,
            onTrackCount,
            totalKpis,
          },
          projectData: {
            stalledProjects,
            completedProjectCount,
            totalProjects: projects.length,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la génération");
        return;
      }

      setNarrative(data.narrative);
      setAiModel(data.model || "");
    } catch {
      setError("Erreur de connexion.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!isConfigured) return;
    setSaving(true);
    setError("");

    try {
      const supabase = getSupabase();
      const { data, error: insertError } = await supabase
        .from("reviews")
        .insert({
          cadence,
          period_label: periodLabel,
          kpi_snapshot: kpis,
          project_snapshot: projects,
          off_track_kpis: offTrackKpis,
          stalled_projects: stalledProjects,
          commentary: commentary || null,
          ai_narrative: narrative || null,
          ai_model: aiModel || null,
        })
        .select("id")
        .single();

      if (insertError) {
        setError("Erreur lors de la sauvegarde: " + insertError.message);
        return;
      }

      router.push(`/reviews/${data.id}`);
    } catch {
      setError("Erreur de connexion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-lg font-bold text-[#1A1A1A] mb-6">Nouvelle Business Review</h1>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00A082] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cadence toggle */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">Cadence</label>
              <div className="flex gap-2">
                {(["weekly", "monthly"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCadence(c)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      cadence === c
                        ? "bg-[#00A082] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {c === "weekly" ? "Weekly" : "Monthly"}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">Période</label>
              <input
                type="text"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A082]"
              />
            </div>

            {/* Preview stats */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Aperçu</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#00A082]">{healthScore}%</p>
                  <p className="text-xs text-gray-500">Health Score</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{offTrackKpis.length}</p>
                  <p className="text-xs text-gray-500">KPIs off-track</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#FFC244]">{stalledProjects.length}</p>
                  <p className="text-xs text-gray-500">Projets en retard</p>
                </div>
              </div>
            </div>

            {/* Generate AI narrative */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Narrative IA</h2>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {generating ? "Génération..." : "Générer la narrative"}
                </button>
              </div>

              {narrative ? (
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
                  {narrative}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Cliquez sur le bouton pour générer une narrative à partir des données actuelles.
                </p>
              )}
            </div>

            {/* Commentary */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Commentaire</label>
              <textarea
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                rows={4}
                placeholder="Ajoutez vos observations et commentaires..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A082] resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || !periodLabel}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#00A082] hover:bg-[#008a6e] text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {saving ? "Sauvegarde..." : "Sauvegarder la review"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
