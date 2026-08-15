"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Section = { id: string; name: string; room: string | null; capacity: number | null };
type SchoolClass = { id: string; name: string; code: string; sections: Section[] };
type AcademicYear = { id: string; name: string; startsOn: string; endsOn: string; isCurrent: boolean; classes: SchoolClass[] };
type Payload = { success: true; data: { academicYears: AcademicYear[]; metrics: { academicYears: number; classes: number; sections: number } } };

const today = new Date().toISOString().slice(0, 10);
export function SchoolWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [data, setData] = useState<Payload["data"]>({ academicYears: [], metrics: { academicYears: 0, classes: 0, sections: 0 } });
  const [mode, setMode] = useState<"year" | "class" | "section" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState({ name: "", startsOn: today, endsOn: today, isCurrent: true });
  const [schoolClass, setSchoolClass] = useState({ academicYearId: "", name: "", code: "", sortOrder: 0 });
  const [section, setSection] = useState({ classId: "", name: "", room: "", capacity: "" });
  const canManage = session?.membership.permissions.includes("SCHOOL_MANAGE") ?? false;
  const classes = data.academicYears.flatMap((item) => item.classes.map((value) => ({ ...value, year: item.name })));

  const load = useCallback(async () => {
    try { const response = await authorizedRequest<Payload>("/school"); setData(response.data); setError(""); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load school setup."); }
  }, [authorizedRequest]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const path = mode === "year" ? "/school/academic-years" : mode === "class" ? "/school/classes" : "/school/sections";
    const body = mode === "year" ? year : mode === "class" ? schoolClass : { ...section, capacity: section.capacity ? Number(section.capacity) : null };
    try { await authorizedRequest(path, { method: "POST", body: JSON.stringify(body) }); setMode(null); setNotice("School structure saved."); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to save school structure."); }
    finally { setSaving(false); }
  }

  return <div className="school-workspace">
    <header className="project-heading"><div><p>Smart school foundation</p><h2>B² School</h2><span>Build the academic structure first. Students, teachers, attendance, and timetables will connect to it.</span></div>{canManage&&<div><button onClick={()=>setMode("year")}>+ Academic year</button><button disabled={!data.academicYears.length} onClick={()=>{setSchoolClass({...schoolClass,academicYearId:data.academicYears[0]?.id??""});setMode("class")}}>+ Class</button><button disabled={!classes.length} onClick={()=>{setSection({...section,classId:classes[0]?.id??""});setMode("section")}}>+ Section</button></div>}</header>
    {error&&<div className="dashboard-notice error">{error}</div>}{notice&&<div className="dashboard-notice success">{notice}</div>}
    <section className="school-metrics"><article><span>Academic years</span><strong>{data.metrics.academicYears}</strong></article><article><span>Classes</span><strong>{data.metrics.classes}</strong></article><article><span>Sections</span><strong>{data.metrics.sections}</strong></article><article><span>Students</span><strong>0</strong><small>Next stage</small></article></section>
    {!data.academicYears.length?<section className="project-empty"><span>⌂</span><h3>No academic structure configured</h3><p>Create your first academic year. No sample classes, students, teachers, attendance, or timetable records are generated.</p>{canManage&&<button onClick={()=>setMode("year")}>Create academic year</button>}</section>:<section className="school-years">{data.academicYears.map(item=><article key={item.id}><header><div><small>{item.isCurrent?"Current academic year":"Academic year"}</small><h3>{item.name}</h3><span>{new Date(item.startsOn).toLocaleDateString()} – {new Date(item.endsOn).toLocaleDateString()}</span></div><b>{item.classes.length} classes</b></header>{!item.classes.length?<p>No classes created for this year.</p>:<div className="school-class-grid">{item.classes.map(value=><div key={value.id}><header><span>{value.code}</span><strong>{value.name}</strong></header><p>{value.sections.length?value.sections.map(entry=>`${entry.name}${entry.room?` · Room ${entry.room}`:""}`).join("  |  "):"No sections"}</p></div>)}</div>}</article>)}</section>}
    {mode&&<div className="agent-modal"><form className="agent-dialog school-dialog" onSubmit={submit}><header><h3>{mode==="year"?"Create academic year":mode==="class"?"Create class":"Create section"}</h3><button type="button" onClick={()=>setMode(null)}>×</button></header><div className="agent-form-grid">{mode==="year"?<><label><span>Name</span><input required placeholder="2026-27" value={year.name} onChange={e=>setYear({...year,name:e.target.value})}/></label><label><span>Starts on</span><input required type="date" value={year.startsOn} onChange={e=>setYear({...year,startsOn:e.target.value})}/></label><label><span>Ends on</span><input required type="date" value={year.endsOn} onChange={e=>setYear({...year,endsOn:e.target.value})}/></label><label className="school-check"><input type="checkbox" checked={year.isCurrent} onChange={e=>setYear({...year,isCurrent:e.target.checked})}/> Make this the current academic year</label></>:mode==="class"?<><label><span>Academic year</span><select required value={schoolClass.academicYearId} onChange={e=>setSchoolClass({...schoolClass,academicYearId:e.target.value})}>{data.academicYears.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Class name</span><input required placeholder="Grade 1" value={schoolClass.name} onChange={e=>setSchoolClass({...schoolClass,name:e.target.value})}/></label><label><span>Class code</span><input required placeholder="G1" value={schoolClass.code} onChange={e=>setSchoolClass({...schoolClass,code:e.target.value})}/></label><label><span>Display order</span><input required type="number" min="0" value={schoolClass.sortOrder} onChange={e=>setSchoolClass({...schoolClass,sortOrder:Number(e.target.value)})}/></label></>:<><label><span>Class</span><select required value={section.classId} onChange={e=>setSection({...section,classId:e.target.value})}>{classes.map(item=><option key={item.id} value={item.id}>{item.year} · {item.name}</option>)}</select></label><label><span>Section name</span><input required placeholder="A" value={section.name} onChange={e=>setSection({...section,name:e.target.value})}/></label><label><span>Room (optional)</span><input value={section.room} onChange={e=>setSection({...section,room:e.target.value})}/></label><label><span>Capacity (optional)</span><input type="number" min="1" max="500" value={section.capacity} onChange={e=>setSection({...section,capacity:e.target.value})}/></label></>}</div><footer><button type="button" onClick={()=>setMode(null)}>Cancel</button><button disabled={saving}>{saving?"Saving…":"Save"}</button></footer></form></div>}
  </div>;
}
