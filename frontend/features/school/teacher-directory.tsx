"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
type Section = { id: string; name: string };
type Class = { id: string; name: string; sections: Section[] };
type Year = { id: string; name: string; classes: Class[] };
type Subject = { id: string; name: string; code: string };
type Teacher = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string | null;
  qualification: string | null;
  maxPeriodsPerDay: number;
  maxPeriodsPerWeek: number;
};
type Assignment = {
  id: string;
  isClassTeacher: boolean;
  teacher: Teacher;
  subject: Subject;
  academicYear: { name: string };
  schoolClass: { name: string };
  section: { name: string };
};
type Data = {
  subjects: Subject[];
  teachers: Teacher[];
  teacherAssignments: Assignment[];
};
export function TeacherDirectory({
  academicYears,
  canManage,
}: {
  academicYears: Year[];
  canManage: boolean;
}) {
  const { authorizedRequest } = useAuth(),
    [data, setData] = useState<Data>({
      subjects: [],
      teachers: [],
      teacherAssignments: [],
    }),
    [mode, setMode] = useState<"subject" | "teacher" | "assign" | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const year0 =
      academicYears.find((y) => y.classes.some((c) => c.sections.length)) ??
      academicYears[0],
    class0 = year0?.classes.find((c) => c.sections.length);
  const [subject, setSubject] = useState({
      name: "",
      code: "",
      description: "",
    }),
    [teacher, setTeacher] = useState({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      qualification: "",
      joinedOn: new Date().toISOString().slice(0, 10),
      maxPeriodsPerDay: 6,
      maxPeriodsPerWeek: 30,
    }),
    [assignment, setAssignment] = useState({
      teacherId: "",
      subjectId: "",
      academicYearId: year0?.id ?? "",
      classId: class0?.id ?? "",
      sectionId: class0?.sections[0]?.id ?? "",
      isClassTeacher: false,
    });
  const year = academicYears.find((y) => y.id === assignment.academicYearId),
    schoolClass = year?.classes.find((c) => c.id === assignment.classId);
  const load = useCallback(async () => {
    try {
      const r = await authorizedRequest<{ data: Data }>("/school");
      setData(r.data);
      setError("");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Unable to load teaching setup.",
      );
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  function openAssign() {
    setAssignment({
      ...assignment,
      teacherId: data.teachers[0]?.id ?? "",
      subjectId: data.subjects[0]?.id ?? "",
    });
    setMode("assign");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const path =
        mode === "subject"
          ? "/school/subjects"
          : mode === "teacher"
            ? "/school/teachers"
            : "/school/teacher-assignments",
      body =
        mode === "subject"
          ? subject
          : mode === "teacher"
            ? teacher
            : assignment;
    try {
      await authorizedRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMode(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to save teaching setup.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="teacher-directory">
      <header>
        <div>
          <p>Teaching operations</p>
          <h3>Teachers, subjects & assignments</h3>
          <span>Define who can teach each subject, class, and section.</span>
        </div>
        {canManage && (
          <div>
            <button onClick={() => setMode("subject")}>+ Subject</button>
            <button onClick={() => setMode("teacher")}>+ Teacher</button>
            <button
              disabled={
                !data.subjects.length || !data.teachers.length || !class0
              }
              onClick={openAssign}
            >
              + Assignment
            </button>
          </div>
        )}
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      <div className="teaching-metrics">
        <span>
          <strong>{data.teachers.length}</strong>Teachers
        </span>
        <span>
          <strong>{data.subjects.length}</strong>Subjects
        </span>
        <span>
          <strong>{data.teacherAssignments.length}</strong>Assignments
        </span>
      </div>
      {!data.teachers.length && !data.subjects.length ? (
        <div className="school-inline-empty">
          No teachers or subjects created.
        </div>
      ) : (
        <div className="teaching-grid">
          <div>
            <h4>Teachers</h4>
            {data.teachers.map((t) => (
              <article key={t.id}>
                <strong>
                  {t.firstName} {t.lastName}
                </strong>
                <small>
                  {t.employeeNumber} ·{" "}
                  {t.qualification || "Qualification not recorded"}
                </small>
                <span>
                  {t.maxPeriodsPerDay}/day · {t.maxPeriodsPerWeek}/week
                </span>
              </article>
            ))}
          </div>
          <div>
            <h4>Assignments</h4>
            {!data.teacherAssignments.length ? (
              <p>No teaching assignments.</p>
            ) : (
              data.teacherAssignments.map((a) => (
                <article key={a.id}>
                  <strong>
                    {a.teacher.firstName} {a.teacher.lastName}
                  </strong>
                  <small>
                    {a.subject.name} · {a.schoolClass.name} {a.section.name}
                  </small>
                  <span>
                    {a.isClassTeacher ? "Class teacher" : a.academicYear.name}
                  </span>
                </article>
              ))
            )}
          </div>
        </div>
      )}
      {mode && (
        <div className="agent-modal">
          <form className="agent-dialog school-dialog" onSubmit={submit}>
            <header>
              <h3>
                {mode === "subject"
                  ? "Create subject"
                  : mode === "teacher"
                    ? "Add teacher"
                    : "Assign teacher"}
              </h3>
              <button type="button" onClick={() => setMode(null)}>
                ×
              </button>
            </header>
            <div className="agent-form-grid">
              {mode === "subject" ? (
                <>
                  <label>
                    <span>Subject name</span>
                    <input
                      required
                      value={subject.name}
                      onChange={(e) =>
                        setSubject({ ...subject, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Code</span>
                    <input
                      required
                      value={subject.code}
                      onChange={(e) =>
                        setSubject({ ...subject, code: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Description</span>
                    <input
                      value={subject.description}
                      onChange={(e) =>
                        setSubject({ ...subject, description: e.target.value })
                      }
                    />
                  </label>
                </>
              ) : mode === "teacher" ? (
                <>
                  {Object.entries(teacher).map(([key, value]) => (
                    <label key={key}>
                      <span>{key.replace(/([A-Z])/g, " $1")}</span>
                      <input
                        required={[
                          "firstName",
                          "joinedOn",
                          "maxPeriodsPerDay",
                          "maxPeriodsPerWeek",
                        ].includes(key)}
                        type={
                          key === "joinedOn"
                            ? "date"
                            : key.startsWith("max")
                              ? "number"
                              : key === "email"
                                ? "email"
                                : "text"
                        }
                        value={value}
                        onChange={(e) =>
                          setTeacher({
                            ...teacher,
                            [key]: key.startsWith("max")
                              ? Number(e.target.value)
                              : e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                </>
              ) : (
                <>
                  <label>
                    <span>Teacher</span>
                    <select
                      value={assignment.teacherId}
                      onChange={(e) =>
                        setAssignment({
                          ...assignment,
                          teacherId: e.target.value,
                        })
                      }
                    >
                      {data.teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Subject</span>
                    <select
                      value={assignment.subjectId}
                      onChange={(e) =>
                        setAssignment({
                          ...assignment,
                          subjectId: e.target.value,
                        })
                      }
                    >
                      {data.subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Academic year</span>
                    <select
                      value={assignment.academicYearId}
                      onChange={(e) => {
                        const y = academicYears.find(
                            (x) => x.id === e.target.value,
                          ),
                          c = y?.classes.find((x) => x.sections.length);
                        setAssignment({
                          ...assignment,
                          academicYearId: e.target.value,
                          classId: c?.id ?? "",
                          sectionId: c?.sections[0]?.id ?? "",
                        });
                      }}
                    >
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Class</span>
                    <select
                      value={assignment.classId}
                      onChange={(e) => {
                        const c = year?.classes.find(
                          (x) => x.id === e.target.value,
                        );
                        setAssignment({
                          ...assignment,
                          classId: e.target.value,
                          sectionId: c?.sections[0]?.id ?? "",
                        });
                      }}
                    >
                      {year?.classes.map((c) => (
                        <option
                          disabled={!c.sections.length}
                          key={c.id}
                          value={c.id}
                        >
                          {c.name}
                          {c.sections.length ? "" : " — add section"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Section</span>
                    <select
                      value={assignment.sectionId}
                      onChange={(e) =>
                        setAssignment({
                          ...assignment,
                          sectionId: e.target.value,
                        })
                      }
                    >
                      {schoolClass?.sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="school-check">
                    <input
                      type="checkbox"
                      checked={assignment.isClassTeacher}
                      onChange={(e) =>
                        setAssignment({
                          ...assignment,
                          isClassTeacher: e.target.checked,
                        })
                      }
                    />{" "}
                    Class teacher
                  </label>
                </>
              )}
            </div>
            <footer>
              <button type="button" onClick={() => setMode(null)}>
                Cancel
              </button>
              <button disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
