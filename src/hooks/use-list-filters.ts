"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type UseListFiltersOptions = {
  /** localStorage key to persist non-default filters under; omit to disable persistence. */
  persistKey?: string;
  /** Debounce delay (ms) before a `search` text-input change is pushed to the URL. */
  searchDebounceMs?: number;
};

/**
 * Shared list-page filter behavior: a debounced `search` URL param, arbitrary
 * dropdown/date filters synced to URL params (always resetting to page 1),
 * and optional localStorage persistence that only restores on a genuine
 * first mount - so explicitly clearing a filter (which also produces a
 * bare/page=1-only URL) never gets silently overwritten by a restore.
 */
export function useListFilters({ persistKey, searchDebounceMs = 400 }: UseListFiltersOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchVal, setSearchVal] = useState(searchParams.get("search") ?? "");

  // Keep the input in sync when `search` changes externally (e.g. a restore, or clearing via another control).
  useEffect(() => {
    setTimeout(() => setSearchVal(searchParams.get("search") ?? ""), 0);
  }, [searchParams]);

  // Debounce: push `search` changes to the URL.
  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (searchVal === current) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      if (searchVal) {
        params.set("search", searchVal);
      } else {
        params.delete("search");
      }
      router.push(`${pathname}?${params.toString()}`);
    }, searchDebounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when searchVal changes; re-running on every searchParams/router identity change would fight the debounce.
  }, [searchVal]);

  // Persist filters to localStorage, restoring only on first mount so an
  // explicit clear (which also collapses the URL to "page=1") always wins.
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!persistKey) return;

    const currentParams = searchParams.toString();
    if (currentParams && currentParams !== "page=1") {
      localStorage.setItem(persistKey, currentParams);
    } else if (!hasRestoredRef.current) {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        router.replace(`${pathname}?${saved}`);
      }
    }
    hasRestoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname/router/persistKey are stable for a given page.
  }, [searchParams]);

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  /** Reads a multi-value filter as a comma-joined URL param, e.g. ?statusId=a,b,c. */
  function getMultiFilter(key: string): string[] {
    const value = searchParams.get(key);
    return value ? value.split(",").filter(Boolean) : [];
  }

  function setMultiFilter(key: string, ids: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (ids.length > 0) {
      params.set(key, ids.join(","));
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  /** Reads a date-range filter stored as `${key}From` / `${key}To` URL params. */
  function getDateRange(key: string): { from: string; to: string } {
    return {
      from: searchParams.get(`${key}From`) ?? "",
      to: searchParams.get(`${key}To`) ?? "",
    };
  }

  function setDateRange(key: string, range: { from: string; to: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (range.from) {
      params.set(`${key}From`, range.from);
    } else {
      params.delete(`${key}From`);
    }
    if (range.to) {
      params.set(`${key}To`, range.to);
    } else {
      params.delete(`${key}To`);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return {
    searchVal,
    setSearchVal,
    setFilter,
    getMultiFilter,
    setMultiFilter,
    getDateRange,
    setDateRange,
    searchParams,
  };
}
