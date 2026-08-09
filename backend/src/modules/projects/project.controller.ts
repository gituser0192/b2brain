import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { ProjectService } from "./project.service.js";
import type { ProjectInput, ProjectMemberInput, TaskInput } from "./project.validation.js";
const s=new ProjectService();function a(r:Parameters<RequestHandler>[0]){if(!r.auth)throw new AppError(401,"Authentication is required.","UNAUTHENTICATED");return r.auth}function id(v:string|string[]|undefined){if(typeof v!=="string")throw new AppError(400,"A valid ID is required.","INVALID_ID");return v}
export const listProjects:RequestHandler=async(r,x)=>x.json(success(await s.list(a(r).organizationId,r.query.archived==="true")));
export const getProject:RequestHandler=async(r,x)=>x.json(success(await s.get(a(r).organizationId,id(r.params.id),true)));
export const createProject:RequestHandler=async(r,x)=>{const c=a(r);x.status(201).json(success(await s.create(c.organizationId,c.userId,r.body as ProjectInput),"Project created."))};
export const updateProject:RequestHandler=async(r,x)=>{const c=a(r);x.json(success(await s.update(c.organizationId,c.userId,id(r.params.id),r.body as ProjectInput),"Project updated."))};
export const archiveProject:RequestHandler=async(r,x)=>{const c=a(r);await s.archive(c.organizationId,c.userId,id(r.params.id));x.json(success({},"Project archived."))};
export const restoreProject:RequestHandler=async(r,x)=>{const c=a(r);await s.restore(c.organizationId,c.userId,id(r.params.id));x.json(success({},"Project restored."))};
export const listTasks:RequestHandler=async(r,x)=>x.json(success(await s.tasks(a(r).organizationId,id(r.params.id))));
export const createTask:RequestHandler=async(r,x)=>{const c=a(r);x.status(201).json(success(await s.createTask(c.organizationId,c.userId,id(r.params.id),r.body as TaskInput),"Task created."))};
export const updateTask:RequestHandler=async(r,x)=>{const c=a(r);await s.updateTask(c.organizationId,c.userId,id(r.params.id),id(r.params.taskId),r.body as TaskInput);x.json(success({},"Task updated."))};
export const archiveTask:RequestHandler=async(r,x)=>{const c=a(r);await s.archiveTask(c.organizationId,c.userId,id(r.params.id),id(r.params.taskId));x.json(success({},"Task archived."))};
export const listProjectMembers:RequestHandler=async(r,x)=>x.json(success(await s.members(a(r).organizationId,id(r.params.id))));
export const addProjectMember:RequestHandler=async(r,x)=>{const c=a(r);x.status(201).json(success(await s.addMember(c.organizationId,c.userId,id(r.params.id),r.body as ProjectMemberInput),"Project member assigned."))};
export const removeProjectMember:RequestHandler=async(r,x)=>{const c=a(r);await s.removeMember(c.organizationId,c.userId,id(r.params.id),id(r.params.projectMemberId));x.json(success({},"Project member removed."))};
