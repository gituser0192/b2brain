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
type GuardianAlert = { id:string;channel:string;recipient:string;subject:string|null;body:string;status:string;createdAt:string;student:{studentNumber:string;firstName:string;lastName:string|null};guardian:{firstName:string;lastName:string|null;relationship:string} };
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
    [visibleStudents, setVisibleStudents] = useState(5),
    [visibleTeachers, setVisibleTeachers] = useState(5),
    [guardianAlerts, setGuardianAlerts] = useState<GuardianAlert[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const [r, alerts] = await Promise.all([authorizedRequest<{ data: Data }>(
        `/school/attendance?date=${date}`,
      ), authorizedRequest<{data:GuardianAlert[]}>(`/school/guardian-alerts?date=${date}`)]);
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
      setGuardianAlerts(alerts.data);
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
        const response = await authorizedRequest<{data:{automation:{matched:boolean;duplicate?:boolean;approvalRequired?:boolean;draftCount?:number;reason?:string}|null}}>("/school/attendance/students", {
          method: "PUT",
          body: JSON.stringify({ date, records }),
        });
        if(response.data.automation?.approvalRequired)setNotice(`Attendance saved. B² Brain prepared ${response.data.automation.draftCount??0} guardian alerts for approval.`);
        else if(response.data.automation?.duplicate)setNotice("Attendance saved. Guardian alerts for this date are already in the approval workflow.");
        else setNotice("Attendance saved.");
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
        const response = await authorizedRequest<{ data: { automation: { matched: boolean; duplicate?: boolean; approvalRequired?: boolean; proposedAssignments?: number; reason?: string } | null } }>("/school/attendance/teachers", {
          method: "PUT",
          body: JSON.stringify({ date, records }),
        });
        if (response.data.automation?.approvalRequired)
          setNotice(`Attendance saved. B² Brain prepared ${response.data.automation.proposedAssignments ?? 0} substitute assignments for approval.`);
        else if (response.data.automation?.duplicate)
          setNotice("Attendance saved. A substitute plan for this date is already awaiting review.");
        else setNotice("Attendance saved.");
      }
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
          onClick={() => {
            setMode("students");
            setVisibleStudents(5);
          }}
        >
          Students
        </button>
        <button
          className={mode === "teachers" ? "active" : ""}
          onClick={() => {
            setMode("teachers");
            setVisibleTeachers(5);
          }}
        >
          Teachers
        </button>
      </div>
      {mode === "students" ? (
        <>
          <div className="attendance-toolbar">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setVisibleStudents(5);
              }}
            >
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
            {students.slice(0, visibleStudents).map((x) => (
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
          {students.length > 5 && (
            <div className="attendance-more">
              {visibleStudents < students.length ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleStudents((count) => count + 5)
                  }
                >
                  Show more ({students.length - visibleStudents} remaining)
                </button>
              ) : (
                <button type="button" onClick={() => setVisibleStudents(5)}>
                  Show less
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
        <div className="attendance-list">
          {data.teachers.slice(0, visibleTeachers).map((x) => (
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
        {data.teachers.length > 5 && (
          <div className="attendance-more">
            {visibleTeachers < data.teachers.length ? (
              <button
                type="button"
                onClick={() => setVisibleTeachers((count) => count + 5)}
              >
                Show more ({data.teachers.length - visibleTeachers} remaining)
              </button>
            ) : (
              <button type="button" onClick={() => setVisibleTeachers(5)}>
                Show less
              </button>
            )}
          </div>
        )}
        </>
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
      {mode==="students"&&guardianAlerts.length>0&&<section className="guardian-alert-history"><header><div><p>Guardian communication</p><h4>Absence alert history</h4></div><span>{guardianAlerts.length} drafts</span></header>{guardianAlerts.slice(0,5).map(item=><article key={item.id}><div><strong>{item.student.firstName} {item.student.lastName}</strong><small>{item.guardian.firstName} · {item.channel} · {item.recipient}</small><p>{item.body}</p></div><i className={item.status.toLowerCase()}>{item.status.replaceAll("_"," ")}</i></article>)}</section>}
    </section>
  );
}
