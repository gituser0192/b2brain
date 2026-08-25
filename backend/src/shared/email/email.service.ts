import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

interface Message { to: string; subject: string; text: string; html: string; }

export class EmailService {
  configured() { return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD); }
  async send(message: Message) {
    if (!this.configured()) return { delivered: false, preview: env.NODE_ENV === "development", messageId: null, error: "SMTP is not configured." };
    const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! } });
    try {
      const result = await transport.sendMail({ from: env.EMAIL_FROM, ...message });
      return { delivered: true, preview: false, messageId: result.messageId || null, error: null };
    } catch (error) {
      return { delivered: false, preview: false, messageId: null, error: error instanceof Error ? error.message : "Email delivery failed." };
    }
  }
  invitation(to: string, organizationName: string, path: string) {
    const url = `${env.FRONTEND_URL}${path}`;
    return this.send({ to, subject: `Join ${organizationName} on B2 Brain`, text: `You were invited to join ${organizationName}. Accept your invitation: ${url}`, html: `<h2>Join ${organizationName}</h2><p>You were invited to collaborate securely in B2 Brain.</p><p><a href="${url}">Accept invitation</a></p><p>This private link expires automatically. Do not forward it.</p>` });
  }
  organizationInvitation(to: string, organizationName: string, path: string) {
    const url = `${env.FRONTEND_URL}${path}`;
    return this.send({ to, subject: `Create your ${organizationName} workspace`, text: `Your B2 Brain workspace invitation is ready: ${url}`, html: `<h2>Your B2 Brain workspace is ready</h2><p>Create the owner account for ${organizationName}.</p><p><a href="${url}">Create workspace</a></p><p>This private link expires automatically.</p>` });
  }
  passwordReset(to: string, path: string) {
    const url = `${env.FRONTEND_URL}${path}`;
    return this.send({ to, subject: "Reset your B2 Brain password", text: `Reset your password: ${url}. This link expires in 30 minutes.`, html: `<h2>Reset your password</h2><p><a href="${url}">Create a new password</a></p><p>This one-time link expires in 30 minutes. If you did not request it, ignore this email.</p>` });
  }
}
