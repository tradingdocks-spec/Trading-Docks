"use client";

import { useEffect, useState } from "react";
import { Clock3, Loader2, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import { getActiveWorkspaceContext } from "@/lib/active-workspace";
import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

type Employee = { id: string; full_name: string; email: string | null; job_title: string | null; employment_status: string; account_status: "uninvited" | "invited" | "active" | "suspended" };

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
      const baseColumns = "id,full_name,email,job_title,employment_status";
      const withAccountStatus = await supabase.from("workspace_employees").select(`${baseColumns},account_status`).eq("workspace_id", workspaceId).order("full_name");
      if (!withAccountStatus.error) {
        setEmployees((withAccountStatus.data ?? []) as Employee[]);
      } else if (/account_status|schema cache|column/i.test(withAccountStatus.error.message ?? "")) {
        const legacy = await supabase.from("workspace_employees").select(baseColumns).eq("workspace_id", workspaceId).order("full_name");
        if (legacy.error) throw legacy.error;
        setEmployees(((legacy.data ?? []) as Omit<Employee, "account_status">[]).map((employee) => ({ ...employee, account_status: "uninvited" })));
      } else {
        throw withAccountStatus.error;
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Employees could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function addEmployee(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/workspace/employees/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: form.full_name, email: form.email, jobTitle: form.job_title }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Employee invitation could not be sent.");
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
    {error ? <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs text-rose-200">{error}</div> : null}
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Employees" value={String(employees.length)} detail="Workspace team records" icon={Users} />
      <MetricCard label="Active" value={String(employees.filter((e) => e.employment_status === "active").length)} detail="Currently active" icon={ShieldCheck} />
      <MetricCard label="Scheduled hours" value="0" detail="Shift scheduling next" icon={Clock3} />
      <MetricCard label="Time cards pending" value="0" detail="Nothing awaiting approval" icon={UserPlus} />
    </div>
    <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
      <div className="flex items-center justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Workspace directory</p><h2 className="mt-2 text-lg font-semibold text-white">Store team</h2></div><span className="text-[10px] text-emerald-300">Cloud saved</span></div>
      {loading ? <Loader2 className="mx-auto my-12 h-5 w-5 animate-spin text-cyan-300" /> : employees.length ? <div className="mt-5 divide-y divide-white/[0.05]">{employees.map((employee) => <div key={employee.id} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-semibold text-white">{employee.full_name}</p><p className="mt-1 text-xs text-slate-500">{employee.job_title || "Team member"}{employee.email ? ` · ${employee.email}` : ""}</p><span className="mt-2 inline-flex rounded-full border border-white/[0.08] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{employee.account_status === "invited" ? "Invitation sent" : employee.account_status}</span></div><button type="button" aria-label={`Remove ${employee.full_name}`} onClick={() => void removeEmployee(employee.id)} className="rounded-lg p-2 text-slate-600 transition hover:bg-rose-400/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <button type="button" onClick={() => setOpen(true)} className="mt-5 w-full rounded-2xl border border-dashed border-white/[0.08] py-10 text-xs text-slate-500 hover:border-cyan-300/20 hover:text-cyan-200">Add your first employee</button>}
    </section>
    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><form onSubmit={addEmployee} className={`${styles.glassPanel} w-full max-w-md rounded-[26px] p-6`}><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold text-white">Invite employee</h2><p className="mt-1 text-xs text-slate-500">They will receive a secure account invitation for this store.</p></div><button type="button" onClick={() => setOpen(false)}><X className="h-5 w-5 text-slate-500" /></button></div><div className="mt-5 space-y-3"><input required value={form.full_name} onChange={(e) => setForm({...form, full_name:e.target.value})} placeholder="Full name" className="workspace-input w-full" /><input required type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})} placeholder="Email" className="workspace-input w-full" /><input value={form.job_title} onChange={(e) => setForm({...form, job_title:e.target.value})} placeholder="Job title" className="workspace-input w-full" /></div><button disabled={saving} className="mt-5 h-11 w-full rounded-xl bg-cyan-400 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Sending invitation…" : "Create and invite"}</button></form></div> : null}
  </WorkspaceFrame>;
}
