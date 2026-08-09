import { AppError } from "../../shared/errors/app-error.js";
import { NotificationRepository } from "./notification.repository.js";

export class NotificationService {
  constructor(private readonly repository = new NotificationRepository()) {}
  list(organizationId: string, userId: string) { return this.repository.list(organizationId, userId); }
  async markRead(organizationId: string, userId: string, id: string) { if ((await this.repository.markRead(organizationId, userId, id, userId)).count !== 1) throw new AppError(404, "Notification was not found.", "NOTIFICATION_NOT_FOUND"); }
  markAllRead(organizationId: string, userId: string) { return this.repository.markAllRead(organizationId, userId, userId); }
}
