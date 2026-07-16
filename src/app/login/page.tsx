"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-sm font-medium">
          Email address
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@epps.com"
          required
          className="h-10"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-sm font-medium">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          required
          className="h-10"
        />
      </div>
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/8 border border-destructive/20 p-3 text-sm text-destructive">
          <svg
            className="size-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {state.error}
        </div>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="mt-1 h-10 font-semibold shadow-sm"
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Signing in...
          </span>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh">
      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-sidebar p-10 relative overflow-hidden">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-20 size-64 rounded-full bg-primary/12 blur-3xl" />
          <div className="absolute -bottom-16 -right-16 size-48 rounded-full bg-amber-500/8 blur-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-80 rounded-full bg-primary/5 blur-3xl" />
        </div>
        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 border border-white/15 p-1.5 overflow-hidden">
            <Image
              src="/brand/EPPS-logo-mark.png"
              alt="EPPS Logo"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <div>
            <div className="text-sidebar-foreground font-bold text-base">EPPS ITAM</div>
            <div className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest">
              Asset Management
            </div>
          </div>
        </div>
        {/* Quote */}
        <div className="relative space-y-3">
          <p className="text-sidebar-foreground/80 text-xl font-light leading-relaxed">
            Manage your entire IT fleet with full visibility, control, and confidence.
          </p>
          <p className="text-sidebar-foreground/40 text-sm">
            EPPS Corporation &mdash; Technology Department
          </p>
        </div>
        {/* Footer stats */}
        <div className="relative grid grid-cols-2 gap-3">
          {[
            { label: "Assets Tracked", value: "Full Lifecycle" },
            { label: "Audit Trail", value: "Complete Logs" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-white/5 border border-white/8 p-3"
            >
              <div className="text-sidebar-foreground/50 text-[10px] uppercase tracking-wider mb-0.5">
                {s.label}
              </div>
              <div className="text-sidebar-foreground font-semibold text-sm">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex flex-1 items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm space-y-8 animate-fade-slide-up">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 overflow-hidden">
              <Image
                src="/brand/EPPS-logo-mark.png"
                alt="EPPS Logo"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <span className="font-bold text-lg">EPPS ITAM</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Sign in to your EPPS ITAM account to continue.
            </p>
          </div>

          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading...</p>
            }
          >
            <LoginForm />
          </Suspense>

          <p className="text-center text-xs text-muted-foreground/60">
            EPPS Corporation &copy; {new Date().getFullYear()}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
