import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

interface Props {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string, coords?: { lat: number; lng: number }) => void;
  /** Bias suggestions toward Florida by default */
  countryCodes?: string;
  viewbox?: string; // "minLon,minLat,maxLon,maxLat"
}

// Free OpenStreetMap Nominatim — no API key.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Florida bounding box (roughly): lon -87.6 to -80.0, lat 24.4 to 31.0
const FL_VIEWBOX = "-87.6,31.0,-80.0,24.4";

export function AddressAutocomplete({
  icon,
  placeholder,
  value,
  onChange,
  countryCodes = "us",
  viewbox = FL_VIEWBOX,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const skipNextFetch = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions (debounced)
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `${NOMINATIM}?format=json&addressdetails=0&limit=6&countrycodes=${countryCodes}&viewbox=${viewbox}&bounded=0&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "en" },
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as Suggestion[];
        setSuggestions(data);
        setOpen(true);
        setHighlight(-1);
      } catch {
        /* aborted or network error — ignore */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, countryCodes, viewbox]);

  // Click outside to close
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (s: Suggestion) => {
    skipNextFetch.current = true;
    onChange(s.display_name, { lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-3 rounded-md border border-border bg-background/60 px-3 py-3">
        {icon}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !suggestions.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && highlight >= 0) {
              e.preventDefault();
              pick(suggestions[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-surface shadow-elevated">
          {suggestions.map((s, i) => (
            <li key={s.place_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className={`block w-full text-left px-3 py-2 text-sm transition ${
                  i === highlight
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                }`}
              >
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
