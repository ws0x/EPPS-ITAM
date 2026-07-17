import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchX, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, or you may not have access to it.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard" />}>
        <Home /> Back to dashboard
      </Button>
    </div>
  );
}
