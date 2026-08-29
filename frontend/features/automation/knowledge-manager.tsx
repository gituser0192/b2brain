"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
const categories = [
  "BUSINESS_OVERVIEW",
  "SERVICE",
  "PRODUCT",
  "PRICING",
  "BUSINESS_HOURS",
  "LOCATION",
  "SERVICE_AREA",
  "FAQ",
  "BOOKING_CONTACT",
  "REFUND_POLICY",
  "CANCELLATION_POLICY",
  "OTHER_POLICY",
  "ADDITIONAL",
] as const;
type Category = (typeof categories)[number];
type Status = "DRAFT" | "APPROVED" | "ARCHIVED";
type Entry = {
  id: string;
  category: Category;
  title: string;
  content: string;
  status: Status;
  updatedAt: string;
  approvedAt: string | null;
};
const empty = {
  category: "BUSINESS_OVERVIEW" as Category,
  title: "",
  content: "",
};
export function KnowledgeManager() {
  const { session, authorizedRequest } = useAuth(),
    canManage = Boolean(
      session?.membership.permissions.includes("AUTOMATION_MANAGE"),
    );
  const [items, setItems] = useState<Entry[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("ALL"),
    [status, setStatus] = useState("ALL"),
    [editing, setEditing] = useState<Entry | null>(null),
    [form, setForm] = useState(empty),
    [open, setOpen] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await authorizedRequest<{ success: true; data: Entry[] }>(
        "/business-knowledge",
      );
      setItems(r.data);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Unable to load business knowledge.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (status === "ALL" || i.status === status) &&
          (category === "ALL" || i.category === category) &&
          (!search.trim() ||
            `${i.title} ${i.content}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [items, status, category, search],
  );
  function edit(item?: Entry) {
    setEditing(item ?? null);
    setForm(
      item
        ? { category: item.category, title: item.title, content: item.content }
        : empty,
    );
    setOpen(true);
    setError("");
    setNotice("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await authorizedRequest(
        editing ? `/business-knowledge/${editing.id}` : "/business-knowledge",
        { method: editing ? "PUT" : "POST", body: JSON.stringify(form) },
      );
      setNotice(
        editing
          ? "Changes saved as a draft. Approve them before agent use."
          : "Knowledge draft created.",
      );
      setOpen(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to save knowledge.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function act(item: Entry, type: "approve" | "archive") {
    try {
      await authorizedRequest(
        `/business-knowledge/${item.id}${type === "approve" ? "/approve" : ""}`,
        { method: type === "approve" ? "POST" : "DELETE" },
      );
      setNotice(
        type === "approve"
          ? "Knowledge approved for customer answers."
          : "Knowledge archived and removed from retrieval.",
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : `Unable to ${type} knowledge.`,
      );
    }
  }
  return (
    <section className="knowledge-manager">
      <header>
        <div>
          <p>Approved customer-facing knowledge</p>
          <h3>Business Knowledge</h3>
          <span>
            Only approved entries can ground external customer answers.
          </span>
        </div>
        {canManage && <button onClick={() => edit()}>+ Add knowledge</button>}
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      {notice && <div className="dashboard-notice success">{notice}</div>}
      <div className="knowledge-toolbar">
        <input
          aria-label="Search knowledge"
          placeholder="Search knowledge"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="ALL">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          <option>DRAFT</option>
          <option>APPROVED</option>
          <option>ARCHIVED</option>
        </select>
      </div>
      {loading ? (
        <div className="dashboard-data-loader">
          <span className="spinner dark" />
          Loading knowledge…
        </div>
      ) : shown.length === 0 ? (
        <div className="project-empty">
          <span>◇</span>
          <h3>No matching knowledge</h3>
          <p>
            Create a draft, review it, then approve it for customer answers.
          </p>
        </div>
      ) : (
        <div className="knowledge-list">
          {shown.map((item) => (
            <article key={item.id}>
              <header>
                <span
                  className={`knowledge-status ${item.status.toLowerCase()}`}
                >
                  {item.status}
                </span>
                <small>{item.category.replaceAll("_", " ")}</small>
              </header>
              <h4>{item.title}</h4>
              <p>{item.content}</p>
              <footer>
                <small>
                  Updated {new Date(item.updatedAt).toLocaleString()}
                </small>
                {canManage && item.status !== "ARCHIVED" && (
                  <div>
                    <button onClick={() => edit(item)}>Edit</button>
                    {item.status === "DRAFT" && (
                      <button onClick={() => void act(item, "approve")}>
                        Approve
                      </button>
                    )}
                    <button onClick={() => void act(item, "archive")}>
                      Archive
                    </button>
                  </div>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
      {open && (
        <div className="modal-backdrop">
          <form className="modal-card knowledge-form" onSubmit={save}>
            <header>
              <h3>{editing ? "Edit knowledge" : "Add knowledge draft"}</h3>
              <button type="button" onClick={() => setOpen(false)}>
                ×
              </button>
            </header>
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as Category })
                }
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={160}
                required
              />
            </label>
            <label>
              Approved customer-facing information
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                maxLength={5000}
                required
              />
            </label>
            <aside>
              <strong>Draft preview</strong>
              <h4>{form.title || "Untitled knowledge"}</h4>
              <p>
                {form.content || "Your customer-facing text will appear here."}
              </p>
            </aside>
            <footer>
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button disabled={saving}>
                {saving ? "Saving…" : "Save draft"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
