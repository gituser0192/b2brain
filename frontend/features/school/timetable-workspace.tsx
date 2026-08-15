"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Assignment = { id:string; teacher:{id:string;firstName:string;lastName:string|null}; subject:{id:string;name:string}; academicYear:{id:string;name:string}; schoolClass:{id:string;name:string}; section:{id:string;name:string;room:string|null} };
type Entry = { id:string;dayOfWeek:number;periodNumber:number;startsAt:string;endsAt:string;room:string|null;teacher:{id:string;firstName:string;lastName:string|null};subject:{name:string;code:string};schoolClass:{name:string};section:{name:string} };
type TimetableData = { entries:Entry[];assignments:Assignment[] };
type Suggestion = { id:string;firstName:string;lastName:string|null;subjectQualified:boolean };
type Need = { entry:Entry & { substitutes:{substituteTeacher:{id:string;firstName:string;lastName:string|null}}[] };suggestions:Suggestion[] };
const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const today=new Date().toISOString().slice(0,10);

export function TimetableWorkspace({canManage}:{canManage:boolean}){
  const {authorizedRequest}=useAuth();
  const [data,setData]=useState<TimetableData>({entries:[],assignments:[]});
  const [mode,setMode]=useState<"schedule"|"substitutes">("schedule");
  const [showForm,setShowForm]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [saving,setSaving]=useState(false);
  const [date,setDate]=useState(today);
  const [needs,setNeeds]=useState<Need[]>([]);
  const [form,setForm]=useState({teacherAssignmentId:"",dayOfWeek:1,periodNumber:1,startsAt:"09:00",endsAt:"09:45",room:""});
  const load=useCallback(async()=>{try{const response=await authorizedRequest<{data:TimetableData}>("/school/timetable");setData(response.data);setError("")}catch(reason){setError(reason instanceof ApiError?reason.message:"Unable to load timetable.")}},[authorizedRequest]);
  useEffect(()=>{const task=setTimeout(()=>void load(),0);return()=>clearTimeout(task)},[load]);
  const byDay=useMemo(()=>days.map((_,index)=>data.entries.filter(entry=>entry.dayOfWeek===index+1)),[data.entries]);
  async function submit(event:FormEvent){event.preventDefault();setSaving(true);setError("");setNotice("");try{await authorizedRequest("/school/timetable",{method:"POST",body:JSON.stringify(form)});setShowForm(false);setNotice("Timetable period created.");await load()}catch(reason){setError(reason instanceof ApiError?reason.message:"Unable to create timetable period.")}finally{setSaving(false)}}
  async function remove(id:string){if(!window.confirm("Remove this timetable period?"))return;try{await authorizedRequest(`/school/timetable/${id}`,{method:"DELETE"});setNotice("Timetable period removed.");await load()}catch(reason){setError(reason instanceof ApiError?reason.message:"Unable to remove timetable period.")}}
  async function loadNeeds(){setError("");try{const response=await authorizedRequest<{data:{needs:Need[]}}>(`/school/substitutes?date=${date}`);setNeeds(response.data.needs)}catch(reason){setError(reason instanceof ApiError?reason.message:"Unable to load substitute requirements.")}}
  async function assign(entryId:string,teacherId:string){if(!teacherId)return;try{await authorizedRequest("/school/substitutes",{method:"PUT",body:JSON.stringify({timetableEntryId:entryId,attendanceDate:date,substituteTeacherId:teacherId,notes:null})});setNotice("Substitute teacher assigned.");await loadNeeds()}catch(reason){setError(reason instanceof ApiError?reason.message:"Unable to assign substitute teacher.")}}
  function openForm(){const first=data.assignments[0];setForm({...form,teacherAssignmentId:first?.id??"",room:first?.section.room??""});setShowForm(true)}
  return <section className="timetable-workspace">
    <header><div><p>Academic scheduling</p><h3>Timetable & substitute teachers</h3><span>Plan weekly periods, prevent conflicts, and cover absent teachers.</span></div>{canManage&&mode==="schedule"&&<button disabled={!data.assignments.length} onClick={openForm}>+ Add period</button>}</header>
    {error&&<div className="dashboard-notice error">{error}</div>}{notice&&<div className="dashboard-notice success">{notice}</div>}
    <div className="attendance-tabs"><button className={mode==="schedule"?"active":""} onClick={()=>setMode("schedule")}>Weekly schedule</button><button className={mode==="substitutes"?"active":""} onClick={()=>setMode("substitutes")}>Substitute desk</button></div>
    {mode==="schedule"?<div className="timetable-days">{days.map((day,index)=><article key={day}><h4>{day}</h4>{byDay[index]?.map(entry=><div className="timetable-period" key={entry.id}><b>{entry.periodNumber}</b><div><strong>{entry.subject.name}</strong><span>{entry.schoolClass.name} {entry.section.name} &middot; {entry.teacher.firstName} {entry.teacher.lastName}</span><small>{entry.startsAt}–{entry.endsAt}{entry.room?` · Room ${entry.room}`:""}</small></div>{canManage&&<button onClick={()=>void remove(entry.id)}>Remove</button>}</div>)}{!byDay[index]?.length&&<p>No periods.</p>}</article>)}</div>:<div className="substitute-desk"><div className="attendance-toolbar"><input type="date" value={date} onChange={event=>setDate(event.target.value)}/><button onClick={()=>void loadNeeds()}>Check absent teachers</button></div>{needs.map(item=><article key={item.entry.id}><div><strong>{item.entry.subject.name} &middot; {item.entry.schoolClass.name} {item.entry.section.name}</strong><span>Period {item.entry.periodNumber}, {item.entry.startsAt}–{item.entry.endsAt} &middot; {item.entry.teacher.firstName} is absent</span></div>{item.entry.substitutes[0]?<b>Covered by {item.entry.substitutes[0].substituteTeacher.firstName} {item.entry.substitutes[0].substituteTeacher.lastName}</b>:canManage?<select defaultValue="" onChange={event=>void assign(item.entry.id,event.target.value)}><option value="">Select substitute</option>{item.suggestions.map(teacher=><option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}{teacher.subjectQualified?" · Subject qualified":""}</option>)}</select>:<span>Not covered</span>}</article>)}{!needs.length&&<div className="school-inline-empty">Choose a date and check for absent teachers who need period coverage.</div>}</div>}
    {showForm&&<div className="agent-modal"><form className="agent-dialog school-dialog" onSubmit={submit}><header><h3>Add timetable period</h3><button type="button" onClick={()=>setShowForm(false)}>×</button></header><div className="agent-form-grid"><label><span>Teaching assignment</span><select required value={form.teacherAssignmentId} onChange={event=>{const assignment=data.assignments.find(item=>item.id===event.target.value);setForm({...form,teacherAssignmentId:event.target.value,room:assignment?.section.room??""})}}>{data.assignments.map(item=><option key={item.id} value={item.id}>{item.teacher.firstName} {item.teacher.lastName} · {item.subject.name} · {item.schoolClass.name} {item.section.name}</option>)}</select></label><label><span>Day</span><select value={form.dayOfWeek} onChange={event=>setForm({...form,dayOfWeek:Number(event.target.value)})}>{days.map((day,index)=><option key={day} value={index+1}>{day}</option>)}</select></label><label><span>Period number</span><input type="number" min="1" max="20" value={form.periodNumber} onChange={event=>setForm({...form,periodNumber:Number(event.target.value)})}/></label><label><span>Starts</span><input required type="time" value={form.startsAt} onChange={event=>setForm({...form,startsAt:event.target.value})}/></label><label><span>Ends</span><input required type="time" value={form.endsAt} onChange={event=>setForm({...form,endsAt:event.target.value})}/></label><label><span>Room</span><input value={form.room} onChange={event=>setForm({...form,room:event.target.value})}/></label></div><footer><button type="button" onClick={()=>setShowForm(false)}>Cancel</button><button disabled={saving}>{saving?"Saving...":"Create period"}</button></footer></form></div>}
  </section>
}
