"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useListFilters } from "@/hooks/use-list-filters";
import { MultiSelectFilter } from "@/components/multi-select-filter";

type MultiFilterConfig = {
  key: string;
  label: string;
  options: { id: string; name: string }[];
};

/**
 * Search box plus zero or more multi-select dropdown filters, all wired to
 * URL params via useListFilters. Extracted from ListSearchBar so list pages
 * that need dropdown filters (Category, Role, Status, ...) don't each
 * re-implement the search box markup - see MultiSelectFilter/useListFilters
 * for the underlying URL-param/localStorage-persistence behavior.
 */
export function ListFilterBar({
  placeholder,
  persistKey,
  multiFilters,
}: {
  placeholder: string;
  persistKey?: string;
  multiFilters: MultiFilterConfig[];
}) {
  const { searchVal, setSearchVal, getMultiFilter, setMultiFilter } = useListFilters({ persistKey });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-72 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
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
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {multiFilters.map((f) => (
        <MultiSelectFilter
          key={f.key}
          label={f.label}
          options={f.options}
          selected={getMultiFilter(f.key)}
          onChange={(ids) => setMultiFilter(f.key, ids)}
        />
      ))}
    </div>
  );
}
