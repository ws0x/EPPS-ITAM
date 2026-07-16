"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Laptop, User, Key, Package, PackageOpen, Receipt, ChevronRight } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { globalSearchAction, type SearchResult } from "@/lib/actions/search";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut (cmd+k or ctrl+k)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        startTransition(async () => {
          const data = await globalSearchAction(query);
          setResults(data);
          setSelectedIndex(0);
        });
      } else {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation within results
  useEffect(() => {
    if (!open) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          setOpen(false);
          router.push(selected.url);
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, results, selectedIndex, router]);

  const IconForType = ({ type }: { type: SearchResult["type"] }) => {
    if (type === "asset") return <Laptop className="w-4 h-4 text-indigo-500" />;
    if (type === "user") return <User className="w-4 h-4 text-emerald-500" />;
    if (type === "license") return <Key className="w-4 h-4 text-amber-500" />;
    if (type === "consumable") return <Package className="w-4 h-4 text-teal-500" />;
    if (type === "kit") return <PackageOpen className="w-4 h-4 text-purple-500" />;
    if (type === "purchaseOrder") return <Receipt className="w-4 h-4 text-rose-500" />;
    return <Search className="w-4 h-4 text-slate-400" />;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] pointer-events-none">
        {/* Backdrop manually handled to look like a frosted glass spotlight */}
        {open && (
          <div
            className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm pointer-events-auto transition-opacity duration-200"
            onClick={() => setOpen(false)}
          />
        )}
        
        {open && (
          <div className="relative z-50 w-full max-w-xl bg-white shadow-2xl rounded-2xl overflow-hidden border border-slate-200/60 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Search Input Header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assets, users, licenses, consumables, kits, or POs..."
                className="flex-1 bg-transparent outline-none text-slate-800 placeholder:text-slate-400 text-lg font-medium"
              />
              {isPending && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
              <div className="hidden sm:flex items-center gap-1">
                <kbd className="px-2 py-1 text-xs font-mono text-slate-400 bg-slate-100 rounded-md">esc</kbd>
              </div>
            </div>

            {/* Results Body */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {query.length > 0 && query.length < 2 && (
                <div className="p-4 text-center text-sm text-slate-500">
                  Type at least 2 characters to search...
                </div>
              )}
              
              {query.length >= 2 && !isPending && results.length === 0 && (
                <div className="p-8 text-center flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                    <Search className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">No results found for &quot;{query}&quot;</p>
                </div>
              )}

              {results.length > 0 && (
                <div className="flex flex-col gap-1">
                  {results.map((result, i) => (
                    <div
                      key={result.id}
                      onClick={() => {
                        setOpen(false);
                        router.push(result.url);
                      }}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${
                        i === selectedIndex
                          ? "bg-indigo-50/80 ring-1 ring-indigo-100"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg bg-white shadow-sm ring-1 ring-slate-100 ${
                        i === selectedIndex ? "shadow-indigo-100/50" : ""
                      }`}>
                        <IconForType type={result.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${
                          i === selectedIndex ? "text-indigo-950" : "text-slate-700"
                        }`}>
                          {result.title}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {result.subtitle}
                        </div>
                      </div>
                      {i === selectedIndex && (
                        <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500 font-mono text-[10px]">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500 font-mono text-[10px]">↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500 font-mono text-[10px]">↵</kbd>
                  to select
                </span>
              </div>
              <div>ITAM Search</div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
