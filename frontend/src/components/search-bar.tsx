"use client";

import { Search, X } from "lucide-react";

export function SearchBar({
  value,
  onChange,
  placeholder = "Search teams, leagues…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] py-2 pl-9 pr-8 text-sm outline-none placeholder:text-slate-600 focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
