"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { Review } from "@/lib/types";
import { Plus, Calendar, FileText } from "lucide-react";

export default function ReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setReviews(data);
        setLoading(false);
      });
  }, []);

  function getHealthFromSnapshot(review: Review): number | null {
    const kpis = review.kpi_snapshot;
    if (!kpis || kpis.length === 0) return null;
    let green = 0;
    let scored = 0;
    for (const kpi of kpis) {
      if (kpi.sub_label) continue;
      // Simple check: if variation exists and is positive, count as green
      if (kpi.performance) {
        scored++;
        const perf = kpi.performance.toLowerCase();
        if (perf.includes("green") || perf.includes("on track")) green++;
      }
    }
    return scored > 0 ? Math.round((green / scored) * 100) : null;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-[#1A1A1A]">Business Reviews</h1>
          <button
            onClick={() => router.push("/reviews/new")}
            className="flex items-center gap-2 px-4 py-2 bg-[#00A082] hover:bg-[#008a6e] text-white font-semibold rounded-lg text-sm transition-colors"
          >
            <Plus size={16} />
            New Review
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00A082] border-t-transparent" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">Aucune review</h2>
            <p className="text-gray-500 mb-6">Créez votre première business review pour commencer le suivi.</p>
            <button
              onClick={() => router.push("/reviews/new")}
              className="px-6 py-2.5 bg-[#00A082] hover:bg-[#008a6e] text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Créer une review
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.map((review) => {
              const health = getHealthFromSnapshot(review);
              return (
                <button
                  key={review.id}
                  onClick={() => router.push(`/reviews/${review.id}`)}
                  className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:border-[#00A082]/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        review.cadence === "weekly"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-purple-50 text-purple-600"
                      }`}
                    >
                      {review.cadence === "weekly" ? "Weekly" : "Monthly"}
                    </span>
                    {health !== null && (
                      <span className="text-sm font-bold" style={{ color: health >= 70 ? "#00A082" : health >= 40 ? "#FFC244" : "#EF4444" }}>
                        {health}%
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1">{review.period_label}</h3>

                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar size={12} />
                    {new Date(review.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>

                  {review.ai_narrative && (
                    <p className="text-xs text-gray-500 mt-3 line-clamp-2">{review.ai_narrative.slice(0, 120)}...</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
