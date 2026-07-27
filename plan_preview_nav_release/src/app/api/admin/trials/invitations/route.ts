import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { buildTrialInvitation } from "@/lib/trial-invitation";

const OWNER_EMAIL = "tradingdocks@gmail.com";
const VALID_PLANS = new Set(["collector", "seller", "business"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RequestBody =
  | { action: "grant"; email: string; planId: string; endsAt: string; notes?: string }
  | { action: "resend"; trialId: string };

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function appBaseUrl(request: Request) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  return (configured ?? new URL(request.url).origin).replace(/\/+$/, "");
}

async function sendInvitation({
  email,
  planId,
  endsAt,
  request,
}: {
  email: string;
  planId: string;
  endsAt: string;
  request: Request;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error(
      "Resend is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to .env.local, then restart the website.",
    );
  }

  const signupUrl = new URL("/sign-up", appBaseUrl(request));
  signupUrl.searchParams.set("email", email);
  signupUrl.searchParams.set("trial", planId);
  const message = buildTrialInvitation({
    email,
    planId,
    endsAt,
    signupUrl: signupUrl.toString(),
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: [
        { name: "email_type", value: "trial_invitation" },
        { name: "trial_plan", value: planId },
      ],
    }),
  });
  const result = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; error?: { message?: string } }
    | null;
  if (!response.ok || !result?.id) {
    throw new Error(
      result?.message ??
        result?.error?.message ??
        "Resend could not send the invitation.",
    );
  }
  return result.id;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in is required.", 401);
  if (user.email?.trim().toLowerCase() !== OWNER_EMAIL) {
    return jsonError("Owner access is required.", 403);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return jsonError("The invitation request was invalid.", 400);
  }

  if (body.action === "grant") {
    const email = body.email?.trim().toLowerCase();
    const planId = body.planId?.trim().toLowerCase();
    const endsAt = new Date(body.endsAt);
    if (!EMAIL_PATTERN.test(email)) return jsonError("Enter a valid customer email.", 400);
    if (!VALID_PLANS.has(planId)) return jsonError("Choose a valid trial plan.", 400);
    if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) {
      return jsonError("Choose an expiration date in the future.", 400);
    }

    const { data: trial, error: insertError } = await supabase
      .from("account_trials")
      .insert({
        email,
        plan_id: planId,
        starts_at: new Date().toISOString(),
        ends_at: endsAt.toISOString(),
        status: "active",
        notes: body.notes?.trim() ?? "",
        granted_by: user.id,
        invitation_status: "pending",
      })
      .select("id,email,plan_id,ends_at")
      .single();
    if (insertError) {
      if (insertError.code === "23505") {
        return jsonError(
          "This email already has an open trial. Use Resend invitation in the trial directory.",
          409,
        );
      }
      return jsonError(`Could not grant trial: ${insertError.message}`, 400);
    }

    try {
      const resendId = await sendInvitation({
        email: trial.email,
        planId: trial.plan_id,
        endsAt: trial.ends_at,
        request,
      });
      await supabase.from("account_trials").update({
        invitation_status: "sent",
        invitation_sent_at: new Date().toISOString(),
        invitation_email_id: resendId,
        invitation_error: "",
      }).eq("id", trial.id);
      return NextResponse.json({ ok: true, trialId: trial.id, emailSent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invitation failed.";
      await supabase.from("account_trials").update({
        invitation_status: "failed",
        invitation_error: message,
      }).eq("id", trial.id);
      return NextResponse.json({
        ok: false,
        trialGranted: true,
        error: `Trial granted, but the invitation was not sent: ${message}`,
      }, { status: 502 });
    }
  }

  if (body.action === "resend") {
    const { data: trial, error } = await supabase
      .from("account_trials")
      .select("id,email,plan_id,ends_at,status")
      .eq("id", body.trialId)
      .single();
    if (error || !trial) return jsonError("Trial not found.", 404);
    if (!["active", "scheduled"].includes(trial.status)) {
      return jsonError("Only open trials can receive another invitation.", 400);
    }
    try {
      const resendId = await sendInvitation({
        email: trial.email,
        planId: trial.plan_id,
        endsAt: trial.ends_at,
        request,
      });
      await supabase.from("account_trials").update({
        invitation_status: "sent",
        invitation_sent_at: new Date().toISOString(),
        invitation_email_id: resendId,
        invitation_error: "",
      }).eq("id", trial.id);
      return NextResponse.json({ ok: true, emailSent: true });
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Invitation failed.";
      await supabase.from("account_trials").update({
        invitation_status: "failed",
        invitation_error: message,
      }).eq("id", trial.id);
      return jsonError(`Invitation was not sent: ${message}`, 502);
    }
  }

  return jsonError("Unknown invitation action.", 400);
}
