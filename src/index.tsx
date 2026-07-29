import React, { createElement } from "react";
import { createRoot } from "react-dom/client";
import { DocumentSearch, type DocumentSearchProps, type DocumentSearchResult } from "./DocumentSearch";

/**
 * <document-search> WebComponent — Design System Italia
 *
 * Usage:
 *   <document-search
 *     api-url="https://api.example.com/search"
 *     placeholder="Cerca nel sito..."
 *     page-size="10"
 *     debounce-ms="300"
 *   ></document-search>
 *
 * Required: include DSI fonts + CSS variables (see below)
 *
 * Integration in any CMS (WordPress, Joomla, Drupal, etc.):
 *   <!-- 1. DSI Fonts -->
 *   <link href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">
 *
 *   <!-- 2. DSI CSS variables (from bootstrap-italia.min.css or custom) -->
 *   <link rel="stylesheet" href="bootstrap-italia.min.css">
 *
 *   <!-- 3. This component -->
 *   <script type="module" src="document-search.js"></script>
 *   <document-search api-url="..." placeholder="..." />
 */
class DocumentSearchElement extends HTMLElement {
  private root: ReturnType<typeof createRoot> | null = null;

  static get observedAttributes() {
    return ["api-url", "placeholder", "page-size", "debounce-ms"];
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    if (!this.root && this.shadowRoot) {
      this.root = createRoot(this.shadowRoot);
    }
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }

  attributeChangedCallback() {
    this.render();
  }

  private getProps(): DocumentSearchProps {
    const getStr = (name: string) => this.getAttribute(name) ?? undefined;
    const getNum = (name: string, fallback: number) =>
      Number(this.getAttribute(name) ?? fallback);

    return {
      apiUrl: this.getAttribute("api-url") || "/search",
      placeholder: getStr("placeholder"),
      pageSize: getNum("page-size", 10),
      debounceMs: getNum("debounce-ms", 300),
      headers: (this as any)._headers ?? {},
    };
  }

  /** Set custom headers programmatically (e.g. Authorization) */
  set searchHeaders(headers: Record<string, string>) {
    (this as any)._headers = headers;
    this.render();
  }

  render() {
    if (!this.root) return;
    this.root.render(createElement(DocumentSearch, this.getProps()));
  }
}

// Register only once
if (!customElements.get("document-search")) {
  customElements.define("document-search", DocumentSearchElement);
}

export { DocumentSearchElement, DocumentSearch, type DocumentSearchProps, type DocumentSearchResult };
