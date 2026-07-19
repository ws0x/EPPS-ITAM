"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationControls({
  page,
  totalPages,
  totalCount,
  limit,
  itemLabel = "items",
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  itemLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between mt-2 px-2 py-3 border-t">
      <span className="text-xs text-muted-foreground font-medium">
        Showing {Math.min((page - 1) * limit + 1, totalCount)} to {Math.min(page * limit, totalCount)} of {totalCount} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)} className="h-8 px-3 text-xs">
          <ChevronLeft className="size-3.5 mr-1" /> Previous
        </Button>
        <span className="text-xs font-semibold px-3 py-1 bg-muted rounded-md border text-foreground">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className="h-8 px-3 text-xs">
          Next <ChevronRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
