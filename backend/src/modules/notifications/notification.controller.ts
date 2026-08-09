import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { NotificationService } from "./notification.service.js";

const service = new NotificationService();
function auth(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED"); return request.auth; }
function id(value: string | string[] | undefined) { if (typeof value !== "string") throw new AppError(400, "A valid notification ID is required.", "INVALID_NOTIFICATION_ID"); return value; }
export const listNotifications: RequestHandler = async (request, response) => { const context = auth(request); response.json(success(await service.list(context.organizationId, context.userId))); };
export const markNotificationRead: RequestHandler = async (request, response) => { const context = auth(request); await service.markRead(context.organizationId, context.userId, id(request.params.id)); response.json(success({}, "Notification marked as read.")); };
export const markAllNotificationsRead: RequestHandler = async (request, response) => { const context = auth(request); await service.markAllRead(context.organizationId, context.userId); response.json(success({}, "Notifications marked as read.")); };
