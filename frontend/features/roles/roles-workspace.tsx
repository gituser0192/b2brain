"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";

interface Permission { code: string; name: string; description: string | null; }
interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isCustom: boolean;
  memberCount: number;
  permissions: Permission[];
}
interface RolesResponse { success: true; data: { roles: Role[]; permissions: Permission[] }; }

export function RolesWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permissionCodes: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const canManage = session?.membership.permissions.includes("ROLE_MANAGE") ?? false;

  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<RolesResponse>("/roles");
      setRoles(response.data.roles);
      setPermissions(response.data.permissions);
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load roles."); }
    finally { setLoading(false); }
  }, [authorizedRequest]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  function openCreate() {
    setEditingRole(null);
    setForm({ name: "", description: "", permissionCodes: ["ORGANIZATION_VIEW"] });
    setEditorOpen(true);
  }
  function openEdit(role: Role) {
    setEditingRole(role);
    setForm({ name: role.name, description: role.description ?? "", permissionCodes: role.permissions.map((permission) => permission.code) });
    setEditorOpen(true);
  }
  function togglePermission(code: string) {
    setForm((current) => ({ ...current, permissionCodes: current.permissionCodes.includes(code) ? current.permissionCodes.filter((item) => item !== code) : [...current.permissionCodes, code] }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await authorizedRequest(editingRole ? `/roles/${editingRole.id}` : "/roles", {
        method: editingRole ? "PATCH" : "POST",
        body: JSON.stringify({ name: form.name, description: form.description || undefined, permissionCodes: form.permissionCodes }),
      });
      setNotice(editingRole ? "Custom role updated." : "Custom role created.");
      setEditorOpen(false);
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to save this role."); }
    finally { setSaving(false); }
  }
  async function remove(role: Role) {
    if (!window.confirm(`Delete the “${role.name}” role?`)) return;
    try {
      await authorizedRequest(`/roles/${role.id}`, { method: "DELETE" });
      setNotice("Custom role deleted.");
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to delete this role."); }
  }

  return (
    <div className="roles-workspace">
      <div className="roles-heading"><div><p>Access architecture</p><h2>Roles & permissions</h2><span>Define responsibility without granting more access than necessary.</span></div>{canManage && <button onClick={openCreate}>+ Create custom role</button>}</div>
      {notice && <div className="dashboard-notice success">{notice}</div>}
      {error && <div className="dashboard-notice error">{error}</div>}

      <section className="permission-principle"><span>◎</span><div><strong>Least-privilege by default</strong><p>System roles are protected. Custom roles belong only to this organization and cannot grant permissions you do not hold.</p></div></section>

      {loading ? <div className="roles-loading"><span className="spinner dark" /> Loading access definitions…</div> : (
        <div className="roles-grid">
          {roles.map((role) => <article className={`role-card ${role.isSystem ? "system" : "custom"}`} key={role.id}>
            <div className="role-card-top"><span className="role-symbol">{role.isSystem ? "S" : "C"}</span><div><span>{role.isSystem ? "System role" : "Custom role"}</span><h3>{role.name}</h3></div><span className="role-members">{role.memberCount} {role.memberCount === 1 ? "member" : "members"}</span></div>
            <p>{role.description ?? "No description provided."}</p>
            <div className="role-permissions">{role.permissions.length ? role.permissions.map((permission) => <span key={permission.code}>{permission.name}</span>) : <em>No permissions</em>}</div>
            <footer><code>{role.code}</code>{role.isCustom && canManage && <div><button onClick={() => openEdit(role)}>Edit</button><button className="danger" onClick={() => void remove(role)}>Delete</button></div>}{role.isSystem && <span>Protected</span>}</footer>
          </article>)}
        </div>
      )}

      <section className="matrix-panel">
        <div className="panel-title"><div><p>Effective access</p><h3>Permission matrix</h3></div><span>{permissions.length} permissions</span></div>
        <div className="permission-matrix"><table><thead><tr><th>Permission</th>{roles.map((role) => <th key={role.id}>{role.name}</th>)}</tr></thead><tbody>{permissions.map((permission) => <tr key={permission.code}><td><strong>{permission.name}</strong><span>{permission.description}</span></td>{roles.map((role) => <td key={role.id} className={role.permissions.some((item) => item.code === permission.code) ? "granted" : ""}>{role.permissions.some((item) => item.code === permission.code) ? "✓" : "—"}</td>)}</tr>)}</tbody></table></div>
      </section>

      {editorOpen && <div className="role-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}><form className="role-editor" onSubmit={save}><div className="settings-title"><div><p>{editingRole ? "Edit custom role" : "New custom role"}</p><h3>{editingRole ? editingRole.name : "Create a focused access profile"}</h3></div><button type="button" onClick={() => setEditorOpen(false)}>×</button></div><label><span>Role name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={80} required /></label><label><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={240} rows={3} /></label><fieldset><legend>Permissions</legend><div className="permission-picker">{permissions.map((permission) => { const grantable = session?.membership.permissions.includes(permission.code) ?? false; return <label key={permission.code} className={`${form.permissionCodes.includes(permission.code) ? "selected" : ""} ${grantable ? "" : "unavailable"}`}><input type="checkbox" checked={form.permissionCodes.includes(permission.code)} disabled={!grantable} onChange={() => togglePermission(permission.code)} /><span><strong>{permission.name}</strong><small>{grantable ? permission.description : "Reserved platform permission"}</small></span></label>; })}</div></fieldset><button className="save-role" disabled={saving || form.permissionCodes.length === 0}>{saving ? "Saving…" : editingRole ? "Save role" : "Create role"}</button></form></div>}
    </div>
  );
}
