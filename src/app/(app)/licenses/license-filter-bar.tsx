"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useListFilters } from "@/hooks/use-list-filters";
import { DateRangeFilter } from "@/components/date-range-filter";

export function LicenseFilterBar() {
  const { searchVal, setSearchVal, getDateRange, setDateRange } = useListFilters({
    persistKey: "itam_licenses_filters",
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-72 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search licenses..."
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          className="pl-9 h-9 text-xs rounded-lg"
        />
        {searchVal && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => setSearchVal("")}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <DateRangeFilter
        label="Expires"
        value={getDateRange("expires")}
        onChange={(range) => setDateRange("expires", range)}
      />
    </div>
  );
}
