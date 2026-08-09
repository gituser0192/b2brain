"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
interface Item { id: string; title: string; message: string; actionPath: string | null; availableAt: string; readAt: string | null; }
interface Response { success: true; data: { notifications: Item[]; unread: number }; }
export function NotificationCenter() {
  const router = useRouter(); const { session, authorizedRequest } = useAuth();
  const [open, setOpen] = useState(false); const [items, setItems] = useState<Item[]>([]); const [unread, setUnread] = useState(0);
  const canView = session?.membership.permissions.includes("NOTIFICATION_VIEW") ?? false;
  const load = useCallback(async () => { if (!canView) return; const response = await authorizedRequest<Response>("/notifications"); setItems(response.data.notifications); setUnread(response.data.unread); }, [authorizedRequest, canView]);
  useEffect(() => { const first = window.setTimeout(() => void load().catch(() => undefined), 0); const polling = window.setInterval(() => void load().catch(() => undefined), 60_000); return () => { window.clearTimeout(first); window.clearInterval(polling); }; }, [load]);
  async function read(item: Item) { if (!item.readAt) await authorizedRequest(`/notifications/${item.id}/read`, { method: "PATCH" }); await load(); setOpen(false); if (item.actionPath) router.push(item.actionPath); }
  async function readAll() { await authorizedRequest("/notifications/read-all", { method: "PATCH" }); await load(); }
  if (!canView) return null;
  return <div className="notification-center"><button type="button" className="notification-bell" aria-label="Notifications" onClick={() => setOpen((value) => !value)}>♢{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}</button>{open && <section className="notification-panel"><header><div><p>Notifications</p><h3>Your inbox</h3></div>{unread > 0 && <button type="button" onClick={() => void readAll()}>Mark all read</button>}</header>{items.length === 0 ? <div className="notification-empty"><span>◇</span><strong>You are all caught up.</strong><p>Due follow-ups and future agent alerts will appear here.</p></div> : <div className="notification-list">{items.map((item) => <button type="button" key={item.id} className={item.readAt ? "read" : "unread"} onClick={() => void read(item)}><i /><div><strong>{item.title}</strong><p>{item.message}</p><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.availableAt))}</small></div></button>)}</div>}</section>}</div>;
}
