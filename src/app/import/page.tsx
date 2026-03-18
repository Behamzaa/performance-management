"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Header from "@/components/layout/Header";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from "lucide-react";

interface ImportResult {
  kpiCount: number;
  projectCount: number;
  warnings: string[];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
      setError("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }

      setResult({
        kpiCount: data.kpiCount,
        projectCount: data.projectCount,
        warnings: data.warnings || [],
      });
    } catch {
      setError("Une erreur est survenue lors de l'import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-lg font-bold text-[#1A1A1A] mb-6">Importer des données</h1>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`bg-white rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-[#00A082] bg-[#00A082]/5"
              : file
              ? "border-[#00A082]/40"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet size={24} className="text-[#00A082]" />
              <div className="text-left">
                <p className="text-sm font-medium text-[#1A1A1A]">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} Ko</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setResult(null);
                  setError("");
                }}
                className="ml-4 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-600 mb-1">
                {isDragActive
                  ? "Déposez le fichier ici..."
                  : "Glissez-déposez un fichier Excel ou cliquez pour sélectionner"}
              </p>
              <p className="text-xs text-gray-400">.xlsx ou .xls</p>
            </>
          )}
        </div>

        {/* Import button */}
        {file && !result && (
          <div className="mt-4 text-center">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-8 py-2.5 bg-[#00A082] hover:bg-[#008a6e] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Import en cours...
                </span>
              ) : (
                "Importer"
              )}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={20} className="text-[#00A082]" />
                <h2 className="text-sm font-semibold text-[#1A1A1A]">Import réussi</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F5F5F5] rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-[#00A082]">{result.kpiCount}</p>
                  <p className="text-xs text-gray-500 mt-1">KPIs importés</p>
                </div>
                <div className="bg-[#F5F5F5] rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-[#00A082]">{result.projectCount}</p>
                  <p className="text-xs text-gray-500 mt-1">Projets importés</p>
                </div>
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="bg-[#FFC244]/10 border border-[#FFC244]/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-[#b8860b]" />
                  <h3 className="text-sm font-semibold text-[#b8860b]">
                    {result.warnings.length} avertissement{result.warnings.length > 1 ? "s" : ""}
                  </h3>
                </div>
                <ul className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-[#b8860b]/80 pl-4">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
