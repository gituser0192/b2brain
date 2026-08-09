import { AppError } from "../../shared/errors/app-error.js";
import { AgentRepository } from "./agent.repository.js";
import type { AgentInput } from "./agent.validation.js";

export class AgentService {
  constructor(private readonly repository = new AgentRepository()) {}
  list(organizationId: string) { return this.repository.list(organizationId); }
  async get(organizationId: string, id: string) { const agent = await this.repository.find(organizationId, id); if (!agent) throw new AppError(404, "Agent was not found.", "AGENT_NOT_FOUND"); return agent; }
  create(organizationId: string, actorUserId: string, input: AgentInput) { return this.repository.create(organizationId, actorUserId, input); }
  async update(organizationId: string, actorUserId: string, id: string, input: AgentInput) { if ((await this.repository.update(organizationId, id, actorUserId, input)).count !== 1) throw new AppError(404, "Agent was not found.", "AGENT_NOT_FOUND"); return this.get(organizationId, id); }
  async archive(organizationId: string, actorUserId: string, id: string) { if ((await this.repository.archive(organizationId, id, actorUserId)).count !== 1) throw new AppError(404, "Agent was not found.", "AGENT_NOT_FOUND"); }
  async runs(organizationId: string, id: string) { await this.get(organizationId, id); return this.repository.runs(organizationId, id); }
}
