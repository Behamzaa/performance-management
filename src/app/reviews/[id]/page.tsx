"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { Review } from "@/lib/types";
import { Calendar, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ReviewDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured || !id) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    supabase
      .from("reviews")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) setReview(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00A082] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <Header />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">Review introuvable.</p>
            <Link href="/reviews" className="text-[#00A082] text-sm mt-2 inline-block hover:underline">
              Retour aux reviews
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const offTrackKpis = review.off_track_kpis || [];
  const stalledProjects = review.stalled_projects || [];

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 no-print">
          <Link
            href="/reviews"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1A1A1A] transition-colors"
          >
            <ArrowLeft size={14} />
            Retour
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer size={14} />
            Imprimer
          </button>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#1A1A1A] mb-1">{review.period_label}</h1>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    review.cadence === "weekly"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-purple-50 text-purple-600"
                  }`}
                >
                  {review.cadence === "weekly" ? "Weekly" : "Monthly"}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar size={12} />
                  {new Date(review.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Off-track KPIs */}
        {offTrackKpis.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              KPIs Off-Track ({offTrackKpis.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">KPI</th>
                    <th className="pb-2 pr-3 font-medium">Bloc</th>
                    <th className="pb-2 pr-3 font-medium">Owner</th>
                    <th className="pb-2 pr-3 font-medium text-right">Target</th>
                    <th className="pb-2 pr-3 font-medium text-right">Actual</th>
                    <th className="pb-2 font-medium text-right">Déviation</th>
                  </tr>
                </thead>
                <tbody>
                  {offTrackKpis.map((kpi, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-2.5 pr-3">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: kpi.status === "red" ? "#EF4444" : "#FFC244" }}
                        />
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-[#1A1A1A]">{kpi.name}</td>
                      <td className="py-2.5 pr-3 text-gray-500">{kpi.block}</td>
                      <td className="py-2.5 pr-3 text-gray-500">{kpi.owner || "—"}</td>
                      <td className="py-2.5 pr-3 text-right text-gray-500">
                        {kpi.target !== null ? kpi.target.toLocaleString() : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-gray-500">
                        {kpi.actual !== null ? kpi.actual.toLocaleString() : "—"}
                      </td>
                      <td
                        className="py-2.5 text-right font-medium"
                        style={{ color: kpi.status === "red" ? "#EF4444" : "#FFC244" }}
                      >
                        {kpi.deviation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stalled Projects */}
        {stalledProjects.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Projets en retard ({stalledProjects.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 pr-3 font-medium">Projet</th>
                    <th className="pb-2 pr-3 font-medium">Bloc</th>
                    <th className="pb-2 pr-3 font-medium">Owner</th>
                    <th className="pb-2 font-medium">Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {stalledProjects.map((project, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-2.5 pr-3 font-medium text-[#1A1A1A]">{project.name}</td>
                      <td className="py-2.5 pr-3 text-gray-500">{project.block}</td>
                      <td className="py-2.5 pr-3 text-gray-500">{project.owner || "—"}</td>
                      <td className="py-2.5 text-gray-500 text-xs">{project.comment || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Narrative */}
        {review.ai_narrative && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Narrative IA</h2>
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
              {review.ai_narrative}
            </div>
            {review.ai_model && (
              <p className="text-xs text-gray-400 mt-2">Généré par {review.ai_model}</p>
            )}
          </div>
        )}

        {/* Commentary */}
        {review.commentary && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Commentaire</h2>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {review.commentary}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
