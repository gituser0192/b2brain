"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
type Section = { id: string; name: string };
type Class = { id: string; name: string; sections: Section[] };
type Year = { id: string; name: string; classes: Class[] };
type Student = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string | null;
  status: string;
  guardians: {
    guardian: {
      firstName: string;
      lastName: string | null;
      relationship: string;
      phone: string;
    };
  }[];
  enrollments: {
    rollNumber: string | null;
    academicYear: { name: string };
    schoolClass: { name: string };
    section: { name: string };
  }[];
};
export function StudentDirectory({
  academicYears,
  canManage,
  onChanged,
}: {
  academicYears: Year[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const { authorizedRequest } = useAuth(),
    [students, setStudents] = useState<Student[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const y0 =
      academicYears.find((y) => y.classes.some((c) => c.sections.length)) ??
      academicYears[0],
    c0 = y0?.classes.find((c) => c.sections.length);
  const blankForm = () => ({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    admissionDate: new Date().toISOString().slice(0, 10),
    academicYearId: y0?.id ?? "",
    classId: c0?.id ?? "",
    sectionId: c0?.sections[0]?.id ?? "",
    rollNumber: "",
    guardian: {
      firstName: "",
      lastName: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
      canPickup: true,
    },
  });
  const [form, setForm] = useState(blankForm);
  const year = academicYears.find((y) => y.id === form.academicYearId),
    schoolClass = year?.classes.find((c) => c.id === form.classId),
    ready = !!c0;
  const load = useCallback(async () => {
    try {
      const r = await authorizedRequest<{ data: { students: Student[] } }>(
        "/school",
      );
      setStudents(r.data.students ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to load students.");
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  function yearChange(id: string) {
    const y = academicYears.find((x) => x.id === id),
      c = y?.classes.find((x) => x.sections.length) ?? y?.classes[0];
    setForm({
      ...form,
      academicYearId: id,
      classId: c?.id ?? "",
      sectionId: c?.sections[0]?.id ?? "",
    });
  }
  function classChange(id: string) {
    const c = year?.classes.find((x) => x.id === id);
    setForm({ ...form, classId: id, sectionId: c?.sections[0]?.id ?? "" });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await authorizedRequest("/school/students", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          dateOfBirth: form.dateOfBirth || null,
        }),
      });
      setOpen(false);
      setForm(blankForm());
      await Promise.all([load(), onChanged()]);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to admit student.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="student-directory">
      <header>
        <div>
          <p>Admissions & guardians</p>
          <h3>Student directory</h3>
          <span>
            Students are connected to a guardian and academic placement.
          </span>
        </div>
        {canManage && (
          <button disabled={!ready} onClick={() => setOpen(true)}>
            + Admit student
          </button>
        )}
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      {!ready ? (
        <div className="school-inline-empty">
          Create a class and section first.
        </div>
      ) : !students.length ? (
        <div className="school-inline-empty">
          No students admitted. This school begins completely empty.
        </div>
      ) : (
        <div className="student-table">
          {students.map((s) => {
            const p = s.enrollments[0],
              g = s.guardians[0]?.guardian;
            return (
              <article key={s.id}>
                <div>
                  <strong>
                    {s.firstName} {s.lastName}
                  </strong>
                  <small>
                    {s.studentNumber}
                    {p?.rollNumber ? ` · Roll ${p.rollNumber}` : ""}
                  </small>
                </div>
                <div>
                  <strong>
                    {p
                      ? `${p.schoolClass.name} · ${p.section.name}`
                      : "Unassigned"}
                  </strong>
                  <small>{p?.academicYear.name}</small>
                </div>
                <div>
                  <strong>
                    {g ? `${g.firstName} ${g.lastName ?? ""}` : "—"}
                  </strong>
                  <small>{g ? `${g.relationship} · ${g.phone}` : ""}</small>
                </div>
                <i>{s.status}</i>
              </article>
            );
          })}
        </div>
      )}
      {open && (
        <div className="agent-modal">
          <form className="agent-dialog student-dialog" onSubmit={submit}>
            <header>
              <h3>Admit a student</h3>
              <button type="button" onClick={() => setOpen(false)}>
                ×
              </button>
            </header>
            <h4>Student details</h4>
            <div className="agent-form-grid">
              <label>
                <span>First name</span>
                <input
                  required
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Last name</span>
                <input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Date of birth</span>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) =>
                    setForm({ ...form, dateOfBirth: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Gender</span>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">Not specified</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                <span>Admission date</span>
                <input
                  required
                  type="date"
                  value={form.admissionDate}
                  onChange={(e) =>
                    setForm({ ...form, admissionDate: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Academic year</span>
                <select
                  value={form.academicYearId}
                  onChange={(e) => yearChange(e.target.value)}
                >
                  {academicYears
                    .filter((y) => y.classes.some((c) => c.sections.length))
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Class</span>
                <select
                  value={form.classId}
                  onChange={(e) => classChange(e.target.value)}
                >
                  {year?.classes.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.sections.length}>
                      {c.name}{c.sections.length ? "" : " — add a section first"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Section</span>
                <select
                  required
                  disabled={!schoolClass?.sections.length}
                  value={form.sectionId}
                  onChange={(e) =>
                    setForm({ ...form, sectionId: e.target.value })
                  }
                >
                  {schoolClass?.sections.length ? schoolClass.sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  )) : <option value="">Create a section first</option>}
                </select>
              </label>
              <label>
                <span>Roll number</span>
                <input
                  value={form.rollNumber}
                  onChange={(e) =>
                    setForm({ ...form, rollNumber: e.target.value })
                  }
                />
              </label>
            </div>
            <h4>Primary guardian</h4>
            <div className="agent-form-grid">
              {(
                [
                  "firstName",
                  "lastName",
                  "relationship",
                  "phone",
                  "email",
                  "address",
                ] as const
              ).map((k) => (
                <label key={k}>
                  <span>{k.replace(/([A-Z])/g, " $1")}</span>
                  <input
                    required={["firstName", "relationship", "phone"].includes(
                      k,
                    )}
                    value={form.guardian[k]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        guardian: { ...form.guardian, [k]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <footer>
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button disabled={saving}>
                {saving ? "Admitting…" : "Admit student"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
