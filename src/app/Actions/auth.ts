"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const email = getString(formData, "email");
  const password = getString(formData, "password");

  if (!email || !password) {
    redirectWithError(
      "/sign-in",
      "Please enter your email address and password.",
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWithError("/sign-in", error.message);
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const name = getString(formData, "name");
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirmPassword");
  const termsAccepted = formData.get("terms") === "on";

  if (!name || !email || !password || !confirmPassword) {
    redirectWithError(
      "/sign-up",
      "Please complete all required fields.",
    );
  }

  if (!termsAccepted) {
    redirectWithError(
      "/sign-up",
      "You must agree to the Terms of Service and Privacy Policy.",
    );
  }

  if (password.length < 8) {
    redirectWithError(
      "/sign-up",
      "Your password must contain at least 8 characters.",
    );
  }

  if (password !== confirmPassword) {
    redirectWithError(
      "/sign-up",
      "The passwords you entered do not match.",
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  if (error) {
    redirectWithError("/sign-up", error.message);
  }

  if (data.session) {
    redirect("/onboarding");
  }

  redirect(
    `/sign-up?success=${encodeURIComponent(
      "Your account was created. Check your email to confirm your account before signing in.",
    )}`,
  );
}

export async function logout() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/sign-in");
}