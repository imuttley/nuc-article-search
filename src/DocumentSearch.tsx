import React, { useState, useCallback, useRef, useEffect } from "react";

export interface DocumentSearchResult {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  date?: string;
  score?: number;
}

export interface DocumentSearchProps {
  /** API endpoint for fulltext search */
  apiUrl: string;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Number of results per page */
  pageSize?: number;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Custom headers passed to API (e.g. Authorization) */
  headers?: Record<string, string>;
  /** Called when results are received */
  onResults?: (results: DocumentSearchResult[], query: string) => void;
  /** Called on errors */
  onError?: (error: Error) => void;
  /** Called when search starts */
  onSearchStart?: (query: string) => void;
}

/** DSI color palette as CSS variables (fallback if not loaded externally) */
const DSI_COLORS = {
  primary: "var(--primary, #0059cc)",
  primaryHover: "var(--primary-hover, #004c99)",
  success: "var(--success, #198938)",
  warning: "var(--warning, #e87729)",
  danger: "var(--danger, #d32f2f)",
  text: "var(--text-dark, #1c1e21)",
  textLight: "var(--text-light, #5a768a)",
  neutral: "var(--neutral-a1, #e6e9ed)",
  neutralDark: "var(--neutral-a3, #c1cad3)",
  neutralLight: "var(--neutral-a7, #f0f4f8)",
  white: "var(--white, #ffffff)",
  highlightBg: "var(--highlight-bg, #fff3cd)",
};

/** Highlight matching terms in text */
function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} style={{ background: DSI_COLORS.highlightBg, padding: "0 2px" }}>{part}</mark> : part
  );
}

export function DocumentSearch({
  apiUrl,
  placeholder = "Cerca nel sito...",
  pageSize = 10,
  debounceMs = 300,
  headers = {},
  onResults,
  onError,
  onSearchStart,
}: DocumentSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(
    async (q: string, p: number) => {
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      onSearchStart?.(q);

      try {
        const params = new URLSearchParams({
          q,
          page: String(p),
          size: String(pageSize),
        });

        const res = await fetch(`${apiUrl}?${params}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Errore ${res.status}: ${res.statusText}`);

        const data = await res.json();
        // Supporta sia risposta piatta che { results: [...], totalResults: N }
        const rawItems = Array.isArray(data)
          ? data
          : data.results ?? data.items ?? data.data ?? [];
        const items: DocumentSearchResult[] = rawItems.map((item: any) => ({
          id: item.id ?? Math.random().toString(36),
          title: item.title ?? item.Titolo ?? "",
          excerpt: item.excerpt ?? item.Abstract ?? item.Descrizione ?? "",
          url: item.url ?? item.Link ?? item.URL ?? "#",
          date: item.date ?? item.Data,
          score: item.score,
        }));

        setResults(items);
        onResults?.(items, q);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const err = e as Error;
        setError(err.message);
        setResults([]);
        onError?.(err);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, pageSize, headers, onResults, onError, onSearchStart]
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query, 0), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setQuery("");
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="document-search"
      style={{
        fontFamily: "'Titillium Web', system-ui, sans-serif",
        maxWidth: "640px",
        width: "100%",
      }}
    >
      {/* DSI Search Bar */}
      <div className="searchbar" style={{ position: "relative" }}>
        <div className="searchbar-input" style={{ position: "relative", display: "flex" }}>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            style={{
              width: "100%",
              padding: "10px 44px 10px 38px",
              fontSize: "16px",
              fontFamily: "'Titillium Web', system-ui, sans-serif",
              border: `2px solid ${DSI_COLORS.neutralDark}`,
              borderRadius: "4px",
              outline: "none",
              boxSizing: "border-box",
              background: DSI_COLORS.white,
              color: DSI_COLORS.text,
              transition: "border-color 0.2s ease",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = DSI_COLORS.primary)}
            onBlur={(e) => (e.currentTarget.style.borderColor = DSI_COLORS.neutralDark)}
          />
          {/* Search icon */}
          <svg
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "18px",
              height: "18px",
              color: DSI_COLORS.textLight,
              pointerEvents: "none",
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Pulisci ricerca"
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                padding: "4px",
                cursor: "pointer",
                color: DSI_COLORS.textLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = DSI_COLORS.neutral)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {/* Loading spinner */}
          {loading && (
            <div
              className="spinner"
              style={{
                position: "absolute",
                right: query ? "36px" : "12px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "18px",
                height: "18px",
                border: `2px solid ${DSI_COLORS.neutral}`,
                borderTopColor: DSI_COLORS.primary,
                borderRadius: "50%",
                animation: "dsi-spin 0.7s linear infinite",
              }}
              aria-label="Ricerca in corso"
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes dsi-spin { to { transform: rotate(360deg); } }
        .document-search .searchbar-input input:focus {
          border-color: ${DSI_COLORS.primary};
          box-shadow: 0 0 0 3px rgba(0, 89, 204, 0.15);
        }
      `}</style>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          style={{
            marginTop: "12px",
            padding: "12px 16px",
            background: "#fce8e8",
            borderLeft: `4px solid ${DSI_COLORS.danger}`,
            borderRadius: "4px",
            color: DSI_COLORS.danger,
            fontSize: "14px",
          }}
        >
          <strong>Errore:</strong> {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div
          className="results-list"
          style={{
            marginTop: "16px",
            border: `1px solid ${DSI_COLORS.neutral}`,
            borderRadius: "4px",
            overflow: "hidden",
            background: DSI_COLORS.white,
          }}
        >
          <div
            style={{
              padding: "8px 16px",
              background: DSI_COLORS.neutralLight,
              borderBottom: `1px solid ${DSI_COLORS.neutral}`,
              fontSize: "13px",
              color: DSI_COLORS.textLight,
            }}
          >
            {results.length} {results.length === 1 ? "risultato" : "risultati"} per "{query}"
          </div>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
            role="list"
          >
            {results.map((doc, idx) => (
              <li
                key={doc.id}
                style={{
                  borderBottom: idx < results.length - 1 ? `1px solid ${DSI_COLORS.neutral}` : "none",
                }}
              >
                <a
                  href={doc.url}
                  style={{
                    display: "block",
                    padding: "14px 16px",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = DSI_COLORS.neutralLight)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: DSI_COLORS.primary,
                      marginBottom: "4px",
                      fontSize: "16px",
                    }}
                  >
                    {highlight(doc.title, query)}
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: DSI_COLORS.textLight,
                      lineHeight: 1.5,
                      marginBottom: "6px",
                    }}
                  >
                    {highlight(doc.excerpt, query)}
                  </div>
                  {doc.date && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: DSI_COLORS.textLight,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {doc.date}
                    </div>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No results */}
      {query.trim() && !loading && results.length === 0 && !error && (
        <div
          style={{
            marginTop: "16px",
            padding: "32px 16px",
            textAlign: "center",
            background: DSI_COLORS.neutralLight,
            borderRadius: "4px",
            color: DSI_COLORS.textLight,
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: "0 auto 12px", opacity: 0.5 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <p style={{ margin: 0, fontSize: "15px" }}>
            Nessun risultato per "<strong>{query}</strong>"
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "13px" }}>
            Prova a modificare i termini di ricerca
          </p>
        </div>
      )}
    </div>
  );
}
