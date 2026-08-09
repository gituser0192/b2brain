import { AppError } from "../../shared/errors/app-error.js";
import { ProjectRepository } from "./project.repository.js";
import type { ProjectInput, ProjectMemberInput, TaskInput } from "./project.validation.js";
export class ProjectService {
  constructor(private r = new ProjectRepository()) {}
  list(o:string,a:boolean){return this.r.list(o,a)}
  async get(o:string,id:string,a=false){const p=await this.r.find(o,id,a);if(!p)throw new AppError(404,"Project was not found.","PROJECT_NOT_FOUND");return p}
  async validateCustomer(o:string,id:string|null|undefined){if(id&&!await this.r.customer(o,id))throw new AppError(404,"Customer was not found.","CUSTOMER_NOT_FOUND")}
  async assignedUser(o:string,m:string|null|undefined,fallback?:string){if(m===undefined)return fallback;if(m===null)return null;const member=await this.r.activeMember(o,m);if(!member)throw new AppError(404,"Active organization member was not found.","MEMBER_NOT_FOUND");return member.userId}
  async create(o:string,u:string,i:ProjectInput){await this.validateCustomer(o,i.customerId);return this.r.create(o,u,i)}
  async update(o:string,u:string,id:string,i:ProjectInput){await this.validateCustomer(o,i.customerId);if((await this.r.update(o,id,u,i)).count!==1)throw new AppError(404,"Project was not found.","PROJECT_NOT_FOUND");return this.get(o,id)}
  async archive(o:string,u:string,id:string){if((await this.r.archive(o,id,u)).count!==1)throw new AppError(404,"Project was not found.","PROJECT_NOT_FOUND")}
  async restore(o:string,u:string,id:string){if((await this.r.restore(o,id,u)).count!==1)throw new AppError(404,"Archived project was not found.","PROJECT_NOT_FOUND")}
  async tasks(o:string,id:string){await this.get(o,id);return this.r.tasks(o,id)}
  async createTask(o:string,u:string,id:string,i:TaskInput){await this.get(o,id);return this.r.createTask(o,id,u,i,(await this.assignedUser(o,i.assignedMembershipId,u))??u)}
  async updateTask(o:string,u:string,p:string,id:string,i:TaskInput){await this.get(o,p);if((await this.r.updateTask(o,p,id,u,i,await this.assignedUser(o,i.assignedMembershipId))).count!==1)throw new AppError(404,"Task was not found.","TASK_NOT_FOUND")}
  async archiveTask(o:string,u:string,p:string,id:string){if((await this.r.archiveTask(o,p,id,u)).count!==1)throw new AppError(404,"Task was not found.","TASK_NOT_FOUND")}
  async members(o:string,p:string){await this.get(o,p);return this.r.members(o,p)}
  async addMember(o:string,u:string,p:string,i:ProjectMemberInput){await this.get(o,p);if(!await this.r.activeEmployee(o,i.employeeId))throw new AppError(404,"Active employee was not found.","EMPLOYEE_NOT_FOUND");return this.r.addMember(o,p,u,i)}
  async removeMember(o:string,u:string,p:string,id:string){if((await this.r.removeMember(o,p,id,u)).count!==1)throw new AppError(404,"Project member was not found.","PROJECT_MEMBER_NOT_FOUND")}
}
