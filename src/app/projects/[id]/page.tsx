"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { Project, Milestone } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock,
  X,
  Circle,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  GripVertical,
  Pencil,
  Save,
} from "lucide-react";

const MONTHS = [
  { key: "jan", label: "January 2026" },
  { key: "feb", label: "February 2026" },
  { key: "mar", label: "March 2026" },
  { key: "apr", label: "April 2026" },
  { key: "may", label: "May 2026" },
  { key: "jun", label: "June 2026" },
];

const CURRENT_MONTH = "mar";

function getStatus(project: Project, month: string): string | null {
  const key = `status_${month}` as keyof Project;
  return project[key] as string | null;
}

function getComment(project: Project, month: string): string | null {
  const key = `comment_${month}` as keyof Project;
  return project[key] as string | null;
}

function normalizeStatus(val: string | null): "Y" | "WIP" | "N" | null {
  if (!val) return null;
  const v = val.trim().toUpperCase();
  if (v === "Y") return "Y";
  if (v === "WIP") return "WIP";
  if (v === "N") return "N";
  return null;
}

function statusConfig(status: "Y" | "WIP" | "N" | null) {
  switch (status) {
    case "Y":
      return {
        color: "#00A082",
        bg: "bg-[#00A082]",
        bgLight: "bg-[#00A082]/10",
        text: "text-[#00A082]",
        border: "border-[#00A082]",
        label: "Completed",
        icon: Check,
      };
    case "WIP":
      return {
        color: "#FFC244",
        bg: "bg-[#FFC244]",
        bgLight: "bg-[#FFC244]/15",
        text: "text-[#b8860b]",
        border: "border-[#FFC244]",
        label: "In Progress",
        icon: Clock,
      };
    case "N":
      return {
        color: "#EF4444",
        bg: "bg-red-500",
        bgLight: "bg-red-50",
        text: "text-red-600",
        border: "border-red-400",
        label: "Off Track",
        icon: X,
      };
    default:
      return {
        color: "#D1D5DB",
        bg: "bg-gray-300",
        bgLight: "bg-gray-50",
        text: "text-gray-400",
        border: "border-gray-300",
        label: "Pending",
        icon: Circle,
      };
  }
}

function blockColor(block: string): string {
  const colors: Record<string, string> = {
    "NORTH STARS": "bg-purple-100 text-purple-700",
    GROWTH: "bg-emerald-100 text-emerald-700",
    "QC & BADS": "bg-orange-100 text-orange-700",
    OPS: "bg-blue-100 text-blue-700",
    LOPS: "bg-cyan-100 text-cyan-700",
    COMMERCIAL: "bg-pink-100 text-pink-700",
    "F&S": "bg-amber-100 text-amber-700",
    PEOPLE: "bg-indigo-100 text-indigo-700",
    BAds: "bg-red-100 text-red-700",
    GA: "bg-teal-100 text-teal-700",
  };
  return colors[block] || "bg-gray-100 text-gray-700";
}

// ─── Milestone Row ───────────────────────────────────────────────

function MilestoneRow({
  milestone,
  onToggle,
  onDelete,
  onUpdateTitle,
}: {
  milestone: Milestone;
  onToggle: (m: Milestone) => void;
  onDelete: (m: Milestone) => void;
  onUpdateTitle: (m: Milestone, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(milestone.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== milestone.title) {
      onUpdateTitle(milestone, trimmed);
    } else {
      setEditValue(milestone.title);
    }
    setEditing(false);
  };

  return (
    <div className="group flex items-center gap-2 py-1 px-1 -mx-1 rounded-md hover:bg-gray-50 transition-colors">
      {/* Checkbox */}
      <button
        onClick={() => onToggle(milestone)}
        className={cn(
          "w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
          milestone.is_done
            ? "bg-[#00A082] border-[#00A082]"
            : "border-gray-300 hover:border-[#00A082]/50"
        )}
        style={{ width: 18, height: 18 }}
        aria-label={milestone.is_done ? "Mark as not done" : "Mark as done"}
      >
        {milestone.is_done && <Check size={10} className="text-white" strokeWidth={3} />}
      </button>

      {/* Title */}
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") {
              setEditValue(milestone.title);
              setEditing(false);
            }
          }}
          className="flex-1 text-sm bg-white border border-[#00A082]/30 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#00A082]/40"
        />
      ) : (
        <span
          onClick={() => {
            setEditing(true);
            setEditValue(milestone.title);
          }}
          className={cn(
            "flex-1 text-sm cursor-text select-none transition-colors",
            milestone.is_done ? "line-through text-gray-400" : "text-gray-700"
          )}
        >
          {milestone.title}
        </span>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(milestone)}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-0.5"
        aria-label="Delete milestone"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Add Milestone Input ─────────────────────────────────────────

function AddMilestoneInput({
  onAdd,
}: {
  onAdd: (title: string) => void;
}) {
  const [value, setValue] = useState("");
  const [active, setActive] = useState(false);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue("");
    }
  };

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00A082] transition-colors mt-1.5 py-1"
      >
        <Plus size={13} />
        Add a milestone...
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <Plus size={13} className="text-gray-400 shrink-0" />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setValue("");
            setActive(false);
          }
        }}
        onBlur={() => {
          if (!value.trim()) setActive(false);
        }}
        placeholder="Add a milestone..."
        className="flex-1 text-sm bg-transparent border-b border-gray-200 focus:border-[#00A082] outline-none py-0.5 placeholder:text-gray-300 transition-colors"
      />
      <button
        onClick={submit}
        disabled={!value.trim()}
        className="text-[#00A082] hover:text-[#00A082]/80 disabled:text-gray-300 transition-colors"
        aria-label="Add milestone"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

// ─── Editable Comment ────────────────────────────────────────────

function EditableComment({
  value,
  onSave,
  placeholder,
}: {
  value: string | null;
  onSave: (val: string | null) => void;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      // Auto-resize
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const commit = () => {
    const trimmed = editValue.trim();
    if (trimmed !== (value || "").trim()) {
      onSave(trimmed || null);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Auto-resize
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditValue(value || "");
              setEditing(false);
            }
            // Ctrl/Cmd+Enter to save
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              commit();
            }
          }}
          className="w-full text-sm text-gray-600 bg-white border border-[#00A082]/30 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#00A082]/20 resize-none leading-relaxed"
          rows={2}
        />
        <span className="text-[10px] text-gray-400 mt-1 block">
          Click outside or Ctrl+Enter to save · Escape to cancel
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        setEditValue(value || "");
        setEditing(true);
      }}
      className="group cursor-text rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-gray-50 transition-colors"
    >
      {value ? (
        <div className="flex items-start gap-2">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line flex-1">
            {value}
          </p>
          <Pencil size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic flex items-center gap-1.5">
          {placeholder}
          <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </p>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  const projectId = params.id as string;

  // Fetch project
  useEffect(() => {
    if (!isConfigured || !projectId) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (data) setProject(data);
        setLoading(false);
      });
  }, [projectId]);

  // Fetch milestones
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/milestones?project_id=${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMilestones(data);
      })
      .catch(() => {});
  }, [projectId]);

  // ── Milestone CRUD (optimistic) ──────────────────────────────

  const addMilestone = useCallback(
    (month: string, title: string) => {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimistic: Milestone = {
        id: tempId,
        project_id: projectId,
        month,
        title,
        is_done: false,
        sort_order: milestones.filter((m) => m.month === month).length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setMilestones((prev) => [...prev, optimistic]);

      fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, month, title }),
      })
        .then((res) => res.json())
        .then((saved) => {
          if (saved?.id) {
            setMilestones((prev) =>
              prev.map((m) => (m.id === tempId ? saved : m))
            );
          }
        })
        .catch(() => {
          setMilestones((prev) => prev.filter((m) => m.id !== tempId));
        });
    },
    [projectId, milestones]
  );

  const toggleMilestone = useCallback((milestone: Milestone) => {
    const newDone = !milestone.is_done;
    setMilestones((prev) =>
      prev.map((m) => (m.id === milestone.id ? { ...m, is_done: newDone } : m))
    );

    fetch("/api/milestones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: milestone.id, is_done: newDone }),
    }).catch(() => {
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestone.id ? { ...m, is_done: milestone.is_done } : m
        )
      );
    });
  }, []);

  const deleteMilestone = useCallback((milestone: Milestone) => {
    setMilestones((prev) => prev.filter((m) => m.id !== milestone.id));

    fetch("/api/milestones", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: milestone.id }),
    }).catch(() => {
      setMilestones((prev) => [...prev, milestone]);
    });
  }, []);

  const updateMilestoneTitle = useCallback((milestone: Milestone, title: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === milestone.id ? { ...m, title } : m))
    );

    fetch("/api/milestones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: milestone.id, title }),
    }).catch(() => {
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestone.id ? { ...m, title: milestone.title } : m
        )
      );
    });
  }, []);

  // ── Update project field (status or comment) ────────────────

  const updateProjectField = useCallback(
    (field: string, value: string | null) => {
      if (!project) return;
      // Optimistic update
      setProject((prev) => prev ? { ...prev, [field]: value } : prev);
      // Persist to Supabase
      getSupabase()
        .from("projects")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", projectId)
        .then(({ error }) => {
          if (error) {
            // Revert on error
            setProject((prev) => prev ? { ...prev, [field]: project[field as keyof Project] } : prev);
          }
        });
    },
    [project, projectId]
  );

  const cycleStatus = useCallback(
    (month: string) => {
      const field = `status_${month}`;
      const current = project ? (project[field as keyof Project] as string | null) : null;
      const normalized = normalizeStatus(current);
      // Cycle: null → N → WIP → Y → null
      const next = normalized === null ? "N" : normalized === "N" ? "WIP" : normalized === "WIP" ? "Y" : null;
      updateProjectField(field, next);
    },
    [project, updateProjectField]
  );

  // ── Helper: milestones for a given month ─────────────────────

  const milestonesForMonth = (month: string) =>
    milestones
      .filter((m) => m.month === month)
      .sort((a, b) => a.sort_order - b.sort_order);

  // ── Loading state ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <Header />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00A082] border-t-transparent" />
          </div>
        </main>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────

  if (!project) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <Header />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#00A082] transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            Back to Projects
          </Link>
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
            Project not found.
          </div>
        </main>
      </div>
    );
  }

  // ── Progress stats ───────────────────────────────────────────

  const monthStatuses = MONTHS.map(({ key }) => normalizeStatus(getStatus(project, key)));
  const completedCount = monthStatuses.filter((s) => s === "Y").length;
  const latestStatus = [...monthStatuses].reverse().find((s) => s !== null) ?? null;
  const latestConfig = statusConfig(latestStatus);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Back link */}
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#00A082] transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Projects
        </Link>

        {/* Top section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-start gap-4 justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-[#1A1A1A]">{project.name}</h1>
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                    blockColor(project.block)
                  )}
                >
                  {project.block}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {project.owner && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-[#00A082]/10 text-[#00A082] flex items-center justify-center text-xs font-semibold">
                      {project.owner.charAt(0).toUpperCase()}
                    </span>
                    {project.owner}
                  </span>
                )}
                {project.priority && (
                  <span className="flex items-center gap-1">
                    Priority <strong className="text-[#1A1A1A]">#{project.priority}</strong>
                  </span>
                )}
                {project.link && (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#00A082] hover:underline"
                  >
                    <ExternalLink size={14} />
                    External doc
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status summary bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm text-gray-500">
                  {completedCount}/{MONTHS.length} months completed
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00A082] rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / MONTHS.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Current status:</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                  latestConfig.bgLight,
                  latestConfig.text
                )}
              >
                <latestConfig.icon size={12} />
                {latestConfig.label}
              </span>
            </div>
          </div>
        </div>

        {/* Milestone Timeline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Calendar size={18} className="text-[#00A082]" />
            <h2 className="text-base font-bold text-[#1A1A1A]">Monthly Timeline</h2>
          </div>

          <div className="relative">
            {MONTHS.map(({ key, label }, index) => {
              const status = normalizeStatus(getStatus(project, key));
              const comment = getComment(project, key);
              const config = statusConfig(status);
              const isCurrent = key === CURRENT_MONTH;
              const isLast = index === MONTHS.length - 1;
              const StatusIcon = config.icon;
              const monthMilestones = milestonesForMonth(key);

              // Determine line color for the segment below this node
              const lineColor =
                status === "Y"
                  ? "bg-[#00A082]"
                  : status === "WIP"
                  ? "bg-[#FFC244]"
                  : status === "N"
                  ? "bg-red-400"
                  : "bg-gray-200";

              return (
                <div key={key} className="relative flex gap-6">
                  {/* Timeline column */}
                  <div className="flex flex-col items-center w-10 shrink-0">
                    {/* Node */}
                    <div
                      className={cn(
                        "relative rounded-full flex items-center justify-center border-2 shrink-0 z-10",
                        isCurrent ? "w-8 h-8" : "w-6 h-6",
                        status !== null
                          ? cn(config.bg, "border-white shadow-md")
                          : "bg-white border-gray-300 border-dashed",
                        isCurrent && "ring-4 ring-[#00A082]/20"
                      )}
                      style={
                        isCurrent
                          ? {
                              animation: "pulse-glow 2s ease-in-out infinite",
                            }
                          : undefined
                      }
                    >
                      <StatusIcon
                        size={isCurrent ? 14 : 12}
                        className={status !== null ? "text-white" : "text-gray-400"}
                        strokeWidth={2.5}
                      />
                    </div>

                    {/* Connecting line */}
                    {!isLast && (
                      <div
                        className={cn("w-0.5 flex-1 min-h-[24px]", lineColor)}
                      />
                    )}
                  </div>

                  {/* Content card */}
                  <div
                    className={cn(
                      "flex-1 pb-6 -mt-0.5",
                      isLast && "pb-0"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-xl border p-4 transition-all",
                        isCurrent
                          ? "border-[#00A082]/30 bg-[#00A082]/[0.03] shadow-sm"
                          : status !== null
                          ? "border-gray-200 bg-white shadow-sm"
                          : "border-gray-100 bg-gray-50/50"
                      )}
                    >
                      {/* Month header + clickable status badge */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            isCurrent ? "text-[#00A082]" : "text-[#1A1A1A]"
                          )}
                        >
                          {label}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#00A082] bg-[#00A082]/10 px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                        {/* Clickable status — cycles N → WIP → Y → clear */}
                        <button
                          onClick={() => cycleStatus(key)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-all hover:ring-2 hover:ring-offset-1",
                            status ? cn(config.bgLight, config.text, `hover:ring-${config.color}`) : "bg-gray-100 text-gray-400 hover:ring-gray-300"
                          )}
                          title="Click to change status"
                        >
                          <StatusIcon size={10} strokeWidth={2.5} />
                          {status || "Set status"}
                        </button>
                      </div>

                      {/* Editable comment */}
                      <EditableComment
                        value={comment}
                        onSave={(val) => updateProjectField(`comment_${key}`, val)}
                        placeholder={status !== null ? "Add an update..." : "Not yet reached"}
                      />

                      {/* Milestones section */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {monthMilestones.length > 0 && (
                          <div className="space-y-0.5">
                            {monthMilestones.map((milestone) => (
                              <MilestoneRow
                                key={milestone.id}
                                milestone={milestone}
                                onToggle={toggleMilestone}
                                onDelete={deleteMilestone}
                                onUpdateTitle={updateMilestoneTitle}
                              />
                            ))}
                          </div>
                        )}
                        <AddMilestoneInput onAdd={(title) => addMilestone(key, title)} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Pulse animation */}
      <style jsx>{`
        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(0, 160, 130, 0.3);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(0, 160, 130, 0);
          }
        }
      `}</style>
    </div>
  );
}
