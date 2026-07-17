"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * Root error boundary - without this, an unhandled error anywhere in the
 * app renders Next.js's default unstyled crash screen instead of anything
 * branded. Client Component per Next.js's error.tsx convention.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred. Try again, or head back to the dashboard - if this keeps
          happening, let your IT administrator know.
        </p>
        {error.digest && (
          <p className="text-[11px] font-mono text-muted-foreground/70">Error ref: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          <Home /> Back to dashboard
        </Button>
      </div>
    </div>
  );
}
