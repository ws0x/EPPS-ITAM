"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

type Option = { id: string; name: string };

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selected, id] : selected.filter((v) => v !== id));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 w-[130px] justify-between text-xs font-normal" />
        }
      >
        <span className="truncate">{selected.length > 0 ? `${label} (${selected.length})` : label}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-[200px] overflow-y-auto">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.id}
            checked={selected.includes(opt.id)}
            onCheckedChange={(checked) => toggle(opt.id, checked === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {opt.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
