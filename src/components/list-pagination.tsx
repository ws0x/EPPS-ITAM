"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Shared page/prev/next control for server-paginated list pages. Reads the
 * current query string and only overrides `page`, so it composes with
 * whatever search/filter params a given list page already has in the URL.
 */
export function ListPagination({
  basePath,
  page,
  totalPages,
  totalCount,
  limit,
  itemLabel = "items",
}: {
  basePath: string;
  page: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  itemLabel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const go = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-between mt-2 px-2 py-3 border-t">
      <span className="text-xs text-muted-foreground font-medium">
        Showing {Math.min((page - 1) * limit + 1, totalCount)} to {Math.min(page * limit, totalCount)} of{" "}
        {totalCount} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)} className="h-8 px-3 text-xs">
          <ChevronLeft className="size-3.5 mr-1" /> Previous
        </Button>
        <span className="text-xs font-semibold px-3 py-1 bg-muted rounded-md border text-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
          className="h-8 px-3 text-xs"
        >
          Next <ChevronRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
