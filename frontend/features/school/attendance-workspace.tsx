"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
type SS = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type TS = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";
type Enrollment = {
  id: string;
  student: {
    studentNumber: string;
    firstName: string;
    lastName: string | null;
  };
  schoolClass: { id: string; name: string };
  section: { id: string; name: string };
};
type Teacher = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string | null;
};
type Data = {
  enrollments: Enrollment[];
  teachers: Teacher[];
  studentRecords: { enrollmentId: string; status: SS }[];
  teacherRecords: { teacherId: string; status: TS }[];
  monthlyStudentSummary: unknown[];
};
export function AttendanceWorkspace({ canManage }: { canManage: boolean }) {
  const { authorizedRequest } = useAuth(),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [mode, setMode] = useState<"students" | "teachers">("students"),
    [data, setData] = useState<Data>({
      enrollments: [],
      teachers: [],
      studentRecords: [],
      teacherRecords: [],
      monthlyStudentSummary: [],
    }),
    [sm, setSm] = useState<Record<string, SS>>({}),
    [tm, setTm] = useState<Record<string, TS>>({}),
    [filter, setFilter] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await authorizedRequest<{ data: Data }>(
        `/school/attendance?date=${date}`,
      );
      setData(r.data);
      setSm(
        Object.fromEntries(
          r.data.studentRecords.map((x) => [x.enrollmentId, x.status]),
        ),
      );
      setTm(
        Object.fromEntries(
          r.data.teacherRecords.map((x) => [x.teacherId, x.status]),
        ),
      );
      setError("");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to load attendance.",
      );
    }
  }, [authorizedRequest, date]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  const classes = useMemo(
      () => [
        ...new Map(
          data.enrollments.map((x) => [x.schoolClass.id, x.schoolClass]),
        ).values(),
      ],
      [data.enrollments],
    ),
    students = filter
      ? data.enrollments.filter((x) => x.schoolClass.id === filter)
      : data.enrollments;
  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (mode === "students") {
        const records = students.map((x) => ({
          enrollmentId: x.id,
          status: sm[x.id] ?? "PRESENT",
          remarks: null,
        }));
        if (!records.length) {
          setError("No students are available.");
          return;
        }
        await authorizedRequest("/school/attendance/students", {
          method: "PUT",
          body: JSON.stringify({ date, records }),
        });
      } else {
        const records = data.teachers.map((x) => ({
          teacherId: x.id,
          status: tm[x.id] ?? "PRESENT",
          checkInAt: null,
          checkOutAt: null,
          remarks: null,
        }));
        if (!records.length) {
          setError("No teachers are available.");
          return;
        }
        await authorizedRequest("/school/attendance/teachers", {
          method: "PUT",
          body: JSON.stringify({ date, records }),
        });
      }
      setNotice("Attendance saved.");
      await load();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to save attendance.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="attendance-workspace">
      <header>
        <div>
          <p>Daily operations</p>
          <h3>Student & teacher attendance</h3>
          <span>
            Record attendance once and safely correct it with an audit trail.
          </span>
        </div>
        <label>
          <span>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      {notice && <div className="dashboard-notice success">{notice}</div>}
      <div className="attendance-tabs">
        <button
          className={mode === "students" ? "active" : ""}
          onClick={() => setMode("students")}
        >
          Students
        </button>
        <button
          className={mode === "teachers" ? "active" : ""}
          onClick={() => setMode("teachers")}
        >
          Teachers
        </button>
      </div>
      {mode === "students" ? (
        <>
          <div className="attendance-toolbar">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {canManage && (
              <button
                onClick={() =>
                  setSm({
                    ...sm,
                    ...Object.fromEntries(
                      students.map((x) => [x.id, "PRESENT"]),
                    ),
                  })
                }
              >
                Mark all present
              </button>
            )}
          </div>
          <div className="attendance-list">
            {students.map((x) => (
              <article key={x.id}>
                <div>
                  <strong>
                    {x.student.firstName} {x.student.lastName}
                  </strong>
                  <small>
                    {x.student.studentNumber} · {x.schoolClass.name}{" "}
                    {x.section.name}
                  </small>
                </div>
                <select
                  disabled={!canManage}
                  value={sm[x.id] ?? "PRESENT"}
                  onChange={(e) =>
                    setSm({ ...sm, [x.id]: e.target.value as SS })
                  }
                >
                  <option>PRESENT</option>
                  <option>ABSENT</option>
                  <option>LATE</option>
                  <option>EXCUSED</option>
                </select>
              </article>
            ))}
            {!students.length && (
              <div className="school-inline-empty">No active students.</div>
            )}
          </div>
        </>
      ) : (
        <div className="attendance-list">
          {data.teachers.map((x) => (
            <article key={x.id}>
              <div>
                <strong>
                  {x.firstName} {x.lastName}
                </strong>
                <small>{x.employeeNumber}</small>
              </div>
              <select
                disabled={!canManage}
                value={tm[x.id] ?? "PRESENT"}
                onChange={(e) => setTm({ ...tm, [x.id]: e.target.value as TS })}
              >
                <option>PRESENT</option>
                <option>ABSENT</option>
                <option>LATE</option>
                <option>HALF_DAY</option>
                <option>LEAVE</option>
              </select>
            </article>
          ))}
          {!data.teachers.length && (
            <div className="school-inline-empty">No active teachers.</div>
          )}
        </div>
      )}
      {canManage && (
        <button
          className="attendance-save"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save attendance"}
        </button>
      )}
    </section>
  );
}
