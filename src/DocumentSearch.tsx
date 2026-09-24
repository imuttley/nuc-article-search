import React, { useState, useCallback, useRef, useEffect } from "react";

export interface DocumentSearchResult {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  date?: string;
  score?: number;
  /** Scopus-style extra fields (passed through by the backend) */
  Authors?: string;
  "Source title"?: string;
  DOI?: string;
  "Document Type"?: string;
  Year?: string | number;
  [key: string]: string | number | undefined;
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
  const [year, setYear] = useState("");
  const [years, setYears] = useState<string[]>([]);
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  // Ordinamento: colonna corrente (chiave campo) e direzione. Default:
  // Year discendente (più recenti in cima), come ordinamento naturale.
  const [sort, setSort] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(
    async (q: string, y: string, p: number, s: string, d: "asc" | "desc") => {
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
        if (y) params.set("year", y);
        if (s) {
          params.set("sort", s);
          params.set("dir", d);
        }

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
        if (Array.isArray(data.years)) setYears(data.years);
        setTotalResults(typeof data.totalResults === "number" ? data.totalResults : 0);

        const rawItems = Array.isArray(data) ? data : data.results ?? data.items ?? data.data ?? [];
        const items: DocumentSearchResult[] = rawItems.map((item: any) => ({
          id: item.id ?? Math.random().toString(36),
          title: item.title ?? item.Titolo ?? item.Title ?? "",
          excerpt: item.excerpt ?? item.Abstract ?? item.Descrizione ?? "",
          url: item.url ?? item.Link ?? item.URL ?? "#",
          date: item.date ?? item.Data,
          score: item.score,
          Authors: item.Authors,
          "Source title": item["Source title"],
          DOI: item.DOI,
          "Document Type": item["Document Type"],
          Year: item.Year,
        }));

        setResults(items);
        setSearched(true);
        onResults?.(items, q);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const err = e as Error;
        setError(err.message);
        setResults([]);
        setTotalResults(0);
        onError?.(err);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, pageSize, headers, onResults, onError, onSearchStart]
  );

  // Debounced full-text search: query/year/page/sort triggers a fetch.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query, year, page, sort, dir), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, year, page, sort, dir, debounceMs, search]);

  // Changing query/year/sort resets pagination to the first page.
  useEffect(() => {
    setPage(0);
  }, [query, year, sort, dir]);

  // Click su un'intestazione: prima selezione → asc; seconda → desc;
  // su una colonna diversa → riparte da asc.
  const toggleSort = (key: string) => {
    if (sort === key) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setDir("asc");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setQuery("");
      inputRef.current?.focus();
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(0, p), totalPages - 1));
  };

  const columns: { key: keyof DocumentSearchResult; label: string }[] = [
    { key: "Authors", label: "Author" },
    { key: "title", label: "Title" },
    { key: "Source title", label: "Source title" },
    { key: "DOI", label: "DOI" },
    { key: "url", label: "Link" },
    { key: "Document Type", label: "Document type" },
    { key: "Year", label: "Year" },
  ];

  return (
    <div
      className="document-search"
      style={{
        fontFamily: "'Titillium Web', system-ui, sans-serif",
        width: "100%",
      }}
    >
      {/* DSI Search Bar */}
      <div className="searchbar">
        <div
          className="searchbar-input-container"
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            border: `2px solid ${DSI_COLORS.neutralDark}`,
            borderRadius: "4px",
            background: DSI_COLORS.white,
            padding: "0 10px 0 12px",
            gap: "8px",
            boxSizing: "border-box",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          }}
        >
          {/* Search icon - rendered before input in flex layout */}
          <svg
            style={{
              width: "18px",
              height: "18px",
              color: DSI_COLORS.textLight,
              flexShrink: 0,
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

          {/* Search input field */}
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              padding: "10px 0",
              margin: 0,
              fontSize: "16px",
              fontFamily: "'Titillium Web', system-ui, sans-serif",
              color: DSI_COLORS.text,
              boxSizing: "border-box",
              boxShadow: "none",
            }}
            onFocus={(e) => {
              const container = e.currentTarget.parentElement;
              if (container) {
                container.style.borderColor = DSI_COLORS.primary;
                container.style.boxShadow = "0 0 0 3px rgba(0, 89, 204, 0.15)";
              }
            }}
            onBlur={(e) => {
              const container = e.currentTarget.parentElement;
              if (container) {
                container.style.borderColor = DSI_COLORS.neutralDark;
                container.style.boxShadow = "none";
              }
            }}
          />

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
                background: "none",
                border: "none",
                padding: "4px",
                cursor: "pointer",
                color: DSI_COLORS.textLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                flexShrink: 0,
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
                width: "18px",
                height: "18px",
                border: `2px solid ${DSI_COLORS.neutral}`,
                borderTopColor: DSI_COLORS.primary,
                borderRadius: "50%",
                flexShrink: 0,
                animation: "dsi-spin 0.7s linear infinite",
              }}
              aria-label="Ricerca in corso"
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes dsi-spin { to { transform: rotate(360deg); } }
        .document-search input[type="search"]::-webkit-search-decoration,
        .document-search input[type="search"]::-webkit-search-cancel-button,
        .document-search input[type="search"]::-webkit-search-results-button,
        .document-search input[type="search"]::-webkit-search-results-decoration {
          -webkit-appearance: none;
          appearance: none;
          display: none;
        }
        .document-search input[type="search"]::-ms-clear,
        .document-search input[type="search"]::-ms-reveal {
          display: none;
          width: 0;
          height: 0;
        }
        .document-search .searchbar-input-container input[type="search"] {
          border: none !important;
          outline: none !important;
          background: transparent !important;
          box-shadow: none !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        /* Riga a altezza fissa: troncamento con ellissi su N righe */
        .document-search .dsi-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: normal;
        }
        .document-search .dsi-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>

      {/* Year filter */}
      <div
        className="year-filter"
        style={{
          marginTop: "12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "14px",
          color: DSI_COLORS.text,
        }}
      >
        <label htmlFor="dsi-year-select" style={{ color: DSI_COLORS.textLight, flexShrink: 0 }}>
          Anno di pubblicazione:
        </label>
        <select
          id="dsi-year-select"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          style={{
            padding: "6px 10px",
            border: `2px solid ${DSI_COLORS.neutralDark}`,
            borderRadius: "4px",
            background: DSI_COLORS.white,
            fontFamily: "'Titillium Web', system-ui, sans-serif",
            fontSize: "14px",
            color: DSI_COLORS.text,
            cursor: "pointer",
          }}
        >
          <option value="">Tutti gli anni</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

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

      {/* Results table */}
      {results.length > 0 && (
        <div
          className="results-list"
          style={{
            marginTop: "16px",
            border: `1px solid ${DSI_COLORS.neutral}`,
            borderRadius: "4px",
            overflowX: "auto",
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
            {totalResults} {totalResults === 1 ? "risultato" : "risultati"} per "{query || "tutti i documenti"}"
            {year && <> · anno {year}</>}
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
              minWidth: "760px",
            }}
          >
            <thead>
              <tr>
                {columns.map((c) => {
                  const isSortable = c.key !== "url";
                  const active = sort === c.key;
                  const arrow = active ? (dir === "asc" ? " ▲" : " ▼") : "";
                  return (
                    <th
                      key={String(c.key)}
                      onClick={isSortable ? () => toggleSort(String(c.key)) : undefined}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        background: DSI_COLORS.neutralLight,
                        borderBottom: `2px solid ${DSI_COLORS.neutralDark}`,
                        color: active ? DSI_COLORS.primary : DSI_COLORS.textLight,
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        whiteSpace: "nowrap",
                        position: "sticky",
                        top: 0,
                        cursor: isSortable ? "pointer" : "default",
                        userSelect: "none",
                      }}
                    >
                      {c.label}
                      {arrow}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {results.map((doc) => (
                <tr
                  key={doc.id}
                  style={{
                    borderBottom: `1px solid ${DSI_COLORS.neutral}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = DSI_COLORS.neutralLight)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {columns.map((c) => {
                    const raw = doc[c.key];
                    const value = raw == null ? "" : String(raw);
                    const isLink = c.key === "url";
                    const isTitle = c.key === "title";
                    const isDoi = c.key === "DOI";
                    // Altezza fissa di riga: ogni cella tronca con ellissi
                    // (line-clamp). Titolo su 2 righe, tutte le altre su 1.
                    const clampClass = isTitle ? "dsi-clamp-2" : "dsi-clamp-1";
                    const cellContent = isLink ? (
                      value && value !== "#" ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: DSI_COLORS.primary,
                            fontSize: "13px",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          Apri link ↗
                        </a>
                      ) : null
                    ) : isDoi ? (
                      value ? (
                        <a
                          href={`https://doi.org/${value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={clampClass}
                          style={{
                            color: DSI_COLORS.primary,
                            fontSize: "12px",
                            textDecoration: "none",
                            wordBreak: "break-all",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          {highlight(value, query)}
                        </a>
                      ) : null
                    ) : isTitle ? (
                      <a
                        href={doc.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={clampClass}
                        style={{
                          color: DSI_COLORS.primary,
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        {highlight(value, query)}
                      </a>
                    ) : (
                      <span className={clampClass} style={{ display: "-webkit-box" }}>
                        {highlight(value, query)}
                      </span>
                    );
                    return (
                      <td
                        key={String(c.key)}
                        style={{
                          padding: "10px 12px",
                          verticalAlign: "top",
                          color: DSI_COLORS.text,
                          fontSize: "13px",
                          lineHeight: 1.45,
                          height: "58px",
                          maxHeight: "58px",
                          overflow: "hidden",
                        }}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="pagination"
          style={{
            marginTop: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            fontSize: "14px",
            color: DSI_COLORS.text,
          }}
        >
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page === 0}
            style={{
              padding: "6px 14px",
              border: `2px solid ${DSI_COLORS.neutralDark}`,
              borderRadius: "4px",
              background: DSI_COLORS.white,
              color: page === 0 ? DSI_COLORS.neutralDark : DSI_COLORS.primary,
              cursor: page === 0 ? "not-allowed" : "pointer",
              fontFamily: "'Titillium Web', system-ui, sans-serif",
              fontSize: "14px",
            }}
          >
            ← Precedente
          </button>
          <span>
            Pagina {page + 1} di {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages - 1}
            style={{
              padding: "6px 14px",
              border: `2px solid ${DSI_COLORS.neutralDark}`,
              borderRadius: "4px",
              background: DSI_COLORS.white,
              color: page >= totalPages - 1 ? DSI_COLORS.neutralDark : DSI_COLORS.primary,
              cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
              fontFamily: "'Titillium Web', system-ui, sans-serif",
              fontSize: "14px",
            }}
          >
            Successiva →
          </button>
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && !error && (
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
            Nessun risultato{query ? <> per "<strong>{query}</strong>"</> : null}
            {year ? <> nell'anno {year}</> : null}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "13px" }}>
            Prova a modificare i termini di ricerca o l'anno selezionato
          </p>
        </div>
      )}
    </div>
  );
}