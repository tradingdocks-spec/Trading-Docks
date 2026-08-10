import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTrialInvitation } from "@/lib/trial-invitation";

const VALID_PLANS = new Set(["collector", "seller", "store"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RequestBody =
  | { action: "grant"; email: string; planId: string; endsAt: string; notes?: string }
  | { action: "resend"; trialId: string };

function cleanEnvironmentValue(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

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
  const apiKey = cleanEnvironmentValue(process.env.RESEND_API_KEY);
  const from = cleanEnvironmentValue(
    process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM,
  );
  if (!apiKey || !from) {
    throw new Error(
      "Production email is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel, then redeploy.",
    );
  }
  if (!apiKey.startsWith("re_") || apiKey.length < 20) {
    throw new Error(
      "RESEND_API_KEY is not a complete Resend key. Replace it in Vercel with the full value shown when the key is created, then redeploy.",
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
    const providerMessage =
      result?.message ??
      result?.error?.message ??
      "Resend could not send the invitation.";
    if (/api key is invalid/i.test(providerMessage)) {
      throw new Error(
        "Resend rejected the deployed RESEND_API_KEY. Create a new Sending access key, replace the Production value in Vercel, and redeploy without reusing the build cache.",
      );
    }
    throw new Error(
      providerMessage,
    );
  }
  return result.id;
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return jsonError("Administrator access is required.", 403);
  const supabase = createAdminClient();

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
        granted_by: actor.user.id,
        invitation_status: "pending",
      })
      .select("id,email,plan_id,ends_at")
      .single();
    if (insertError) {
      if (insertError.code === "23505") {
        const { data: existingTrial, error: existingError } = await supabase
          .from("account_trials")
          .select("id,email,plan_id,ends_at,status")
          .ilike("email", email)
          .in("status", ["active", "scheduled"])
          .maybeSingle();
        if (existingError || !existingTrial) {
          return jsonError(
            "This email already has an open trial. Use Resend invitation in the trial directory.",
            409,
          );
        }
        try {
          const resendId = await sendInvitation({
            email: existingTrial.email,
            planId: existingTrial.plan_id,
            endsAt: existingTrial.ends_at,
            request,
          });
          await supabase.from("account_trials").update({
            invitation_status: "sent",
            invitation_sent_at: new Date().toISOString(),
            invitation_email_id: resendId,
            invitation_error: "",
          }).eq("id", existingTrial.id);
          return NextResponse.json({
            ok: true,
            trialId: existingTrial.id,
            emailSent: true,
            reusedExistingTrial: true,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Invitation failed.";
          await supabase.from("account_trials").update({
            invitation_status: "failed",
            invitation_error: message,
          }).eq("id", existingTrial.id);
          return NextResponse.json({
            ok: false,
            trialGranted: true,
            trialId: existingTrial.id,
            error: `The existing trial is still active, but the invitation was not sent: ${message}`,
          }, { status: 502 });
        }
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
