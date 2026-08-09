import { AppError } from "../../shared/errors/app-error.js";
import { EngagementRepository } from "./engagement.repository.js";
import type { CreateActivityInput, CreateFollowUpInput, UpdateFollowUpStatusInput } from "./engagement.validation.js";

export class EngagementService {
  constructor(private readonly repository = new EngagementRepository()) {}
  private async requireCustomer(organizationId: string, customerId: string) { if (!await this.repository.customer(organizationId, customerId)) throw new AppError(404, "Customer was not found.", "CUSTOMER_NOT_FOUND"); }
  async timeline(organizationId: string, customerId: string) { await this.requireCustomer(organizationId, customerId); return this.repository.timeline(organizationId, customerId); }
  async createActivity(organizationId: string, customerId: string, actorUserId: string, input: CreateActivityInput) { await this.requireCustomer(organizationId, customerId); return this.repository.createActivity(organizationId, customerId, actorUserId, input); }
  async archiveActivity(organizationId: string, customerId: string, actorUserId: string, id: string) { if ((await this.repository.archiveActivity(organizationId, customerId, id, actorUserId)).count !== 1) throw new AppError(404, "Activity was not found.", "ACTIVITY_NOT_FOUND"); }
  async createFollowUp(organizationId: string, customerId: string, actorUserId: string, input: CreateFollowUpInput) { await this.requireCustomer(organizationId, customerId); return this.repository.createFollowUp(organizationId, customerId, actorUserId, input); }
  async updateFollowUpStatus(organizationId: string, customerId: string, actorUserId: string, id: string, input: UpdateFollowUpStatusInput) { if ((await this.repository.updateFollowUpStatus(organizationId, customerId, id, actorUserId, input)).count !== 1) throw new AppError(404, "Follow-up was not found.", "FOLLOW_UP_NOT_FOUND"); }
  async archiveFollowUp(organizationId: string, customerId: string, actorUserId: string, id: string) { if ((await this.repository.archiveFollowUp(organizationId, customerId, id, actorUserId)).count !== 1) throw new AppError(404, "Follow-up was not found.", "FOLLOW_UP_NOT_FOUND"); }
}
