"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const ACTION_TYPES = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "checkout", label: "Checked out" },
  { value: "checkin", label: "Checked in" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function AuditLogFilters({ targetTypes }: { targetTypes: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/audit-logs?${next.toString()}`);
  }

  const hasFilters = searchParams.toString().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get("targetType") ?? undefined} onValueChange={(v) => setParam("targetType", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Target type" />
        </SelectTrigger>
        <SelectContent>
          {targetTypes.map((t) => (
            <SelectItem key={t} value={t} className="capitalize">
              {t.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("actionType") ?? undefined} onValueChange={(v) => setParam("actionType", v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Action" />
        </SelectTrigger>
        <SelectContent>
          {ACTION_TYPES.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        className="w-auto"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => setParam("from", e.target.value || null)}
      />
      <span className="text-muted-foreground text-sm">to</span>
      <Input
        type="date"
        className="w-auto"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => setParam("to", e.target.value || null)}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/audit-logs")}>
          <X /> Clear filters
        </Button>
      )}
    </div>
  );
}
