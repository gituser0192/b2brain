import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

interface Message { to: string; subject: string; text: string; html: string; }

export class EmailService {
  configured() { return Boolean(env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD)); }
  async send(message: Message) {
    if (env.RESEND_API_KEY) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.RESEND_FROM, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          logger.warn({ status: response.status }, "Resend email delivery rejected");
          return { delivered: false, preview: false, messageId: null, error: `Email provider rejected the message (HTTP ${response.status}).` };
        }
        const result = await response.json() as { id?: unknown };
        return { delivered: true, preview: false, messageId: typeof result.id === "string" ? result.id : null, error: null };
      } catch {
        logger.warn("Resend email delivery failed");
        return { delivered: false, preview: false, messageId: null, error: "Email provider is temporarily unavailable." };
      }
    }
    if (!this.configured()) {
      logger.warn("Email delivery skipped: SMTP is not configured");
      return { delivered: false, preview: env.NODE_ENV === "development", messageId: null, error: "SMTP is not configured." };
    }
    const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! } });
    try {
      const result = await transport.sendMail({ from: env.EMAIL_FROM, ...message });
      return { delivered: true, preview: false, messageId: result.messageId || null, error: null };
    } catch (error) {
      const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
      const safeCode = ["EAUTH", "ECONNECTION", "ESOCKET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EENVELOPE", "EMESSAGE"].includes(code) ? code : "UNKNOWN";
      logger.warn({ code: safeCode }, "Email delivery failed");
      return { delivered: false, preview: false, messageId: null, error: error instanceof Error ? error.message : "Email delivery failed." };
    }
  }
  invitation(to: string, organizationName: string, path: string) {
    const url = `${env.FRONTEND_URL}${path}`;
    return this.send({ to, subject: `Join ${organizationName} on SATHOS`, text: `You were invited to join ${organizationName}. Accept your invitation: ${url}`, html: `<h2>Join ${organizationName}</h2><p>You were invited to collaborate securely in SATHOS.</p><p><a href="${url}">Accept invitation</a></p><p>This private link expires automatically. Do not forward it.</p>` });
  }
  organizationInvitation(to: string, organizationName: string, path: string) {
    const url = `${env.FRONTEND_URL}${path}`;
    return this.send({ to, subject: `Create your ${organizationName} workspace`, text: `Your SATHOS workspace invitation is ready: ${url}`, html: `<h2>Your SATHOS workspace is ready</h2><p>Create the owner account for ${organizationName}.</p><p><a href="${url}">Create workspace</a></p><p>This private link expires automatically.</p>` });
  }
  passwordReset(to: string, path: string) {
    const url = `${env.FRONTEND_URL}${path}`;
    return this.send({ to, subject: "Reset your SATHOS password", text: `Reset your password: ${url}. This link expires in 30 minutes.`, html: `<h2>Reset your password</h2><p><a href="${url}">Create a new password</a></p><p>This one-time link expires in 30 minutes. If you did not request it, ignore this email.</p>` });
  }
}
