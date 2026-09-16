"use client";

import { useEffect, useState } from "react";
import { Clock3, Loader2, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import { getActiveWorkspaceContext } from "@/lib/active-workspace";
import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

type Employee = { id: string; full_name: string; email: string | null; job_title: string | null; employment_status: string };

export function EmployeesWorkspace() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", job_title: "" });

  async function load() {
    try {
      const { supabase, workspaceId } = await getActiveWorkspaceContext();
      const { data, error: loadError } = await supabase.from("workspace_employees").select("id,full_name,email,job_title,employment_status").eq("workspace_id", workspaceId).order("full_name");
      if (loadError) throw loadError;
      setEmployees((data ?? []) as Employee[]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Employees could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function addEmployee(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const { supabase, workspaceId, userId } = await getActiveWorkspaceContext();
      const { error: saveError } = await supabase.from("workspace_employees").insert({ workspace_id: workspaceId, created_by: userId, full_name: form.full_name.trim(), email: form.email.trim() || null, job_title: form.job_title.trim() || null });
      if (saveError) throw saveError;
      setForm({ full_name: "", email: "", job_title: "" }); setOpen(false); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Employee could not be saved."); }
    finally { setSaving(false); }
  }

  async function removeEmployee(id: string) {
    const { supabase, workspaceId } = await getActiveWorkspaceContext();
    const { error: removeError } = await supabase.from("workspace_employees").delete().eq("id", id).eq("workspace_id", workspaceId);
    if (removeError) setError(removeError.message); else setEmployees((current) => current.filter((employee) => employee.id !== id));
  }

  return <WorkspaceFrame>
    <PageHeader eyebrow="Employee operations" title="Your team, securely connected to your store." description="Employees and roles are saved to this workspace and available to authorized managers on every device." icon={Users} actionLabel="Add employee" onAction={() => setOpen(true)} />
    {error ? <div className="mt-4 rounded-xl border border-td-danger/20 bg-td-danger/[0.06] p-3 text-xs text-td-danger">{error}</div> : null}
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Employees" value={String(employees.length)} detail="Workspace team records" icon={Users} />
      <MetricCard label="Active" value={String(employees.filter((e) => e.employment_status === "active").length)} detail="Currently active" icon={ShieldCheck} />
      <MetricCard label="Scheduled hours" value="0" detail="Shift scheduling next" icon={Clock3} />
      <MetricCard label="Time cards pending" value="0" detail="Nothing awaiting approval" icon={UserPlus} />
    </div>
    <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
      <div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">Workspace directory</p><h2 className="mt-2 text-lg font-semibold text-td-primary">Store team</h2></div><span className="text-[11px] text-td-success">Cloud saved</span></div>
      {loading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-td-accent-text" /> : employees.length ? <div className="mt-5 divide-y divide-td-ink/[0.05]">{employees.map((employee) => <div key={employee.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-semibold text-td-primary">{employee.full_name}</p><p className="mt-1 text-xs text-td-muted">{employee.job_title || "Team member"}{employee.email ? ` · ${employee.email}` : ""}</p></div><button type="button" aria-label={`Remove ${employee.full_name}`} onClick={() => void removeEmployee(employee.id)} className="rounded-lg p-2 text-td-muted transition hover:bg-td-danger/10 hover:text-td-danger"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <button type="button" onClick={() => setOpen(true)} className="mt-5 w-full rounded-2xl border border-dashed border-td-ink/[0.08] py-10 text-xs text-td-muted hover:border-td-accent/20 hover:text-td-accent-text">Add your first employee</button>}
    </section>
    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><form onSubmit={addEmployee} className={`${styles.glassPanel} w-full max-w-md rounded-[26px] p-6`}><div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-td-primary">Add employee</h2><button type="button" onClick={() => setOpen(false)}><X className="h-5 w-5 text-td-muted" /></button></div><div className="mt-5 space-y-3"><input required value={form.full_name} onChange={(e) => setForm({...form, full_name:e.target.value})} placeholder="Full name" className="workspace-input w-full" /><input type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})} placeholder="Email" className="workspace-input w-full" /><input value={form.job_title} onChange={(e) => setForm({...form, job_title:e.target.value})} placeholder="Job title" className="workspace-input w-full" /></div><button disabled={saving} className="mt-5 h-11 w-full rounded-xl bg-td-accent text-sm font-semibold text-td-on-accent disabled:opacity-50">{saving ? "Saving…" : "Save employee"}</button></form></div> : null}
  </WorkspaceFrame>;
}
