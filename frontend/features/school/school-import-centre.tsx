"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type ImportError = {
  sheet: string;
  row: number;
  field: string;
  message: string;
};
type Preview = {
  batchId: string;
  students: { valid: number; total: number };
  teachers: { valid: number; total: number };
  failed: number;
  errors: ImportError[];
  canImport: boolean;
  expiresAt: string;
  preview: {
    students: {
      row: number;
      firstName: string;
      lastName: string | null;
      rollNumber: string | null;
    }[];
    teachers: {
      row: number;
      firstName: string;
      lastName: string | null;
      email: string | null;
    }[];
  };
};

export function SchoolImportCentre({
  onImported,
}: {
  onImported: () => void | Promise<void>;
}) {
  const { authorizedRequest } = useAuth();
  const [file, setFile] = useState<File | null>(null),
    [kind, setKind] = useState<"STUDENTS" | "TEACHERS">("STUDENTS"),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const response = await authorizedRequest<{ data: Preview }>(
        "/school/imports/preview",
        { method: "POST", body },
      );
      setPreview(response.data);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to preview the import file.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview?.canImport) return;
    setBusy(true);
    setError("");
    try {
      const response = await authorizedRequest<{
        data: { studentsImported: number; teachersImported: number };
      }>("/school/imports/confirm", {
        method: "POST",
        body: JSON.stringify({ batchId: preview.batchId }),
      });
      setNotice(
        `${response.data.studentsImported} students and ${response.data.teachersImported} teachers imported.`,
      );
      setPreview(null);
      setFile(null);
      await onImported();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to confirm the import.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="school-import-centre">
      <header>
        <div>
          <p>Bulk onboarding</p>
          <h3>School Data Import Centre</h3>
          <span>
            Upload existing school records, review every row, then confirm once.
          </span>
        </div>
        <a href="/templates/b2-school-import-template.xlsx" download>
          Download Excel template
        </a>
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      {notice && <div className="dashboard-notice success">{notice}</div>}
      <form onSubmit={upload}>
        <label>
          <span>Excel or CSV file</span>
          <input
            required
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        </label>
        {file?.name.toLowerCase().endsWith(".csv") && (
          <label>
            <span>CSV contains</span>
            <select
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as "STUDENTS" | "TEACHERS")
              }
            >
              <option value="STUDENTS">Students & guardians</option>
              <option value="TEACHERS">Teachers</option>
            </select>
          </label>
        )}
        <button disabled={busy || !file}>
          {busy ? "Checking..." : "Preview import"}
        </button>
      </form>
      <div className="import-safety">
        <b>No data is saved during preview.</b>
        <span>
          Organization ownership is taken from your verified login, never from
          the spreadsheet.
        </span>
      </div>
      {preview && (
        <div className="import-preview">
          <div className="import-summary">
            <span>
              <strong>{preview.students.valid}</strong> valid students /{" "}
              {preview.students.total}
            </span>
            <span>
              <strong>{preview.teachers.valid}</strong> valid teachers /{" "}
              {preview.teachers.total}
            </span>
            <span className={preview.failed ? "failed" : "ready"}>
              <strong>{preview.failed}</strong> failed rows
            </span>
          </div>
          {preview.errors.length > 0 && (
            <div className="import-errors">
              <h4>Fix these rows and upload again</h4>
              {preview.errors.map((item, index) => (
                <article
                  key={`${item.sheet}-${item.row}-${item.field}-${index}`}
                >
                  <b>
                    {item.sheet} row {item.row}
                  </b>
                  <span>
                    {item.field}: {item.message}
                  </span>
                </article>
              ))}
            </div>
          )}
          {preview.canImport && (
            <>
              <div className="import-sample">
                <h4>Preview</h4>
                {preview.preview.students.map((item) => (
                  <span key={`student-${item.row}`}>
                    Student row {item.row}: {item.firstName} {item.lastName}{" "}
                    {item.rollNumber ? `· Roll ${item.rollNumber}` : ""}
                  </span>
                ))}
                {preview.preview.teachers.map((item) => (
                  <span key={`teacher-${item.row}`}>
                    Teacher row {item.row}: {item.firstName} {item.lastName}{" "}
                    {item.email ? `· ${item.email}` : ""}
                  </span>
                ))}
              </div>
              <button
                className="confirm-import"
                disabled={busy}
                onClick={() => void confirm()}
              >
                {busy ? "Importing..." : "Confirm and import all valid rows"}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
