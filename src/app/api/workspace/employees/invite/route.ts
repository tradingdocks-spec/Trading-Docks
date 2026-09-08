import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/+$/, "");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ ok: false, error: "Sign in again to invite an employee." }, { status: 401 });

  const body = await request.json().catch(() => null) as { fullName?: unknown; email?: unknown; jobTitle?: unknown } | null;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim().slice(0, 160) : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const jobTitle = typeof body?.jobTitle === "string" ? body.jobTitle.trim().slice(0, 160) : "";
  if (!fullName || !EMAIL_PATTERN.test(email)) return NextResponse.json({ ok: false, error: "Enter the employee's name and a valid email address." }, { status: 400 });

  const { data: preference } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).single();
  const workspaceId = preference?.active_workspace_id as string | null | undefined;
  if (!workspaceId) return NextResponse.json({ ok: false, error: "No active store workspace is available." }, { status: 400 });

  const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin", "manager"].includes(membership.role)) return NextResponse.json({ ok: false, error: "Manager access is required to invite employees." }, { status: 403 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from("workspace_employees").select("id,account_status").eq("workspace_id", workspaceId).ilike("email", email).maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: "An employee record already exists for this email in the store." }, { status: 409 });

  const { data: employee, error: employeeError } = await admin.from("workspace_employees").insert({
    workspace_id: workspaceId,
    created_by: user.id,
    full_name: fullName,
    email,
    job_title: jobTitle || null,
    account_status: "uninvited",
  }).select("id").single();
  if (employeeError || !employee) {
    const message = employeeError?.message ?? "Employee could not be created.";
    const migrationRequired = /account_status|workspace_members_role_check|column .* does not exist|schema cache/i.test(message);
    return NextResponse.json({ ok: false, error: migrationRequired ? "Employee invitations are not enabled in this deployment yet. Apply the employee account migration, then retry." : message }, { status: migrationRequired ? 503 : 400 });
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, employee_workspace_id: workspaceId, employee_record_id: employee.id },
    redirectTo: `${appBaseUrl(request)}/auth/callback?next=${encodeURIComponent("/dashboard/employees")}`,
  });
  if (inviteError || !invited.user) {
    await admin.from("workspace_employees").update({ invitation_error: inviteError?.message ?? "The invitation could not be sent." }).eq("id", employee.id);
    return NextResponse.json({ ok: false, error: inviteError?.message ?? "The invitation could not be sent." }, { status: 502 });
  }

  const linkedUserId = invited.user.id;
  const { error: linkError } = await admin.from("workspace_employees").update({ linked_user_id: linkedUserId, account_status: "invited", invitation_sent_at: new Date().toISOString(), invitation_error: "" }).eq("id", employee.id);
  if (linkError) return NextResponse.json({ ok: false, error: linkError.message }, { status: 500 });

  await admin.from("workspace_members").upsert({ workspace_id: workspaceId, user_id: linkedUserId, role: "employee" }, { onConflict: "workspace_id,user_id" });
  await admin.from("user_preferences").upsert({ user_id: linkedUserId, active_workspace_id: workspaceId }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true, employeeId: employee.id, email, accountStatus: "invited" });
}
