"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { Project, BLOCK_ORDER } from "@/lib/types";
import { ChevronDown, ChevronRight } from "lucide-react";

const MONTH_LABELS = [
  { key: "jan", label: "Jan" },
  { key: "feb", label: "Fév" },
  { key: "mar", label: "Mar" },
  { key: "apr", label: "Avr" },
  { key: "may", label: "Mai" },
  { key: "jun", label: "Juin" },
];

function statusBg(val: string | null): string {
  if (!val) return "";
  const v = val.trim().toUpperCase();
  if (v === "Y") return "bg-[#00A082]/15 text-[#00A082] font-semibold";
  if (v === "WIP") return "bg-[#FFC244]/20 text-[#b8860b] font-semibold";
  if (v === "N") return "bg-red-50 text-red-600 font-semibold";
  return "";
}

function statusLabel(val: string | null): string {
  if (!val) return "";
  const v = val.trim().toUpperCase();
  if (v === "Y") return "Y";
  if (v === "WIP") return "WIP";
  if (v === "N") return "N";
  return val;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockFilter, setBlockFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    supabase
      .from("projects")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        if (data) setProjects(data);
        setLoading(false);
      });
  }, []);

  const owners = useMemo(() => {
    const set = new Set(projects.map((p) => p.owner).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [projects]);

  const blocks = useMemo(() => {
    const set = new Set(projects.map((p) => p.block));
    return BLOCK_ORDER.filter((b) => set.has(b));
  }, [projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (blockFilter !== "All" && p.block !== blockFilter) return false;
      if (ownerFilter !== "All" && p.owner !== ownerFilter) return false;
      if (statusFilter !== "All") {
        const months = [p.status_jan, p.status_feb, p.status_mar, p.status_apr, p.status_may, p.status_jun];
        const latest = [...months].reverse().find((v) => v !== null);
        if (!latest) return false;
        const v = latest.trim().toUpperCase();
        if (statusFilter === "Y" && v !== "Y") return false;
        if (statusFilter === "WIP" && v !== "WIP") return false;
        if (statusFilter === "N" && v !== "N") return false;
      }
      return true;
    });
  }, [projects, blockFilter, ownerFilter, statusFilter]);

  function getComment(project: Project, month: string): string | null {
    const key = `comment_${month}` as keyof Project;
    return project[key] as string | null;
  }

  function getStatus(project: Project, month: string): string | null {
    const key = `status_${month}` as keyof Project;
    return project[key] as string | null;
  }

  const comments = expandedRow
    ? MONTH_LABELS.map(({ key, label }) => ({
        label,
        comment: getComment(
          projects.find((p) => p.id === expandedRow)!,
          key
        ),
      })).filter((c) => c.comment)
    : [];

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-lg font-bold text-[#1A1A1A] mb-4">Project Tracker</h1>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-3">
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A082]"
          >
            <option value="All">Tous les blocs</option>
            {blocks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A082]"
          >
            <option value="All">Tous les owners</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A082]"
          >
            <option value="All">Tous les statuts</option>
            <option value="Y">Complété (Y)</option>
            <option value="WIP">En cours (WIP)</option>
            <option value="N">Retard (N)</option>
          </select>

          <span className="text-xs text-gray-400 ml-auto">{filtered.length} projets</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00A082] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
            Aucun projet trouvé.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50/50 border-b border-gray-100">
                    <th className="px-4 py-3 font-medium w-8"></th>
                    <th className="px-3 py-3 font-medium w-12">#</th>
                    <th className="px-3 py-3 font-medium">Bloc</th>
                    <th className="px-3 py-3 font-medium">Projet</th>
                    <th className="px-3 py-3 font-medium">Owner</th>
                    {MONTH_LABELS.map(({ label }) => (
                      <th key={label} className="px-3 py-3 font-medium text-center w-16">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((project) => {
                    const isExpanded = expandedRow === project.id;
                    const monthComments = MONTH_LABELS.map(({ key, label }) => ({
                      label,
                      comment: getComment(project, key),
                    })).filter((c) => c.comment);

                    return (
                      <>
                        <tr
                          key={project.id}
                          onClick={() => router.push(`/projects/${project.id}`)}
                          className="border-t border-gray-50 hover:bg-[#00A082]/[0.03] cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5 text-gray-400">
                            {monthComments.length > 0 &&
                              (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400">{project.priority || "—"}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs">{project.block}</td>
                          <td className="px-3 py-2.5 font-medium text-[#1A1A1A]">{project.name}</td>
                          <td className="px-3 py-2.5 text-gray-500">{project.owner || "—"}</td>
                          {MONTH_LABELS.map(({ key }) => {
                            const val = getStatus(project, key);
                            return (
                              <td key={key} className="px-3 py-2.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${statusBg(val)}`}>
                                  {statusLabel(val)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                        {isExpanded && monthComments.length > 0 && (
                          <tr key={`${project.id}-comments`} className="bg-gray-50/50">
                            <td colSpan={11} className="px-8 py-3">
                              <div className="space-y-2">
                                {monthComments.map(({ label, comment }) => (
                                  <div key={label} className="text-xs">
                                    <span className="font-semibold text-gray-600">{label}:</span>{" "}
                                    <span className="text-gray-500">{comment}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
