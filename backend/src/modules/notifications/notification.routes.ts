import { Router } from "express";
import { requireActiveContext, requireAuth, requirePermission } from "../../middleware/auth.js";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "./notification.controller.js";

export const notificationRouter = Router();
notificationRouter.use(requireAuth, requireActiveContext, requirePermission("NOTIFICATION_VIEW"));
notificationRouter.get("/", listNotifications);
notificationRouter.patch("/read-all", markAllNotificationsRead);
notificationRouter.patch("/:id/read", markNotificationRead);
