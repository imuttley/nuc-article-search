# @nicosia/document-search

React WebComponent for fulltext document search. Drop into any CMS (WordPress, Joomla, Drupal, etc.) with a single script tag.

## Features

- **Custom Element** (`<document-search>`) — works in any HTML page
- **Async search** with debounce, AbortController cancellation, and loading spinner
- **Highlighted matches** — query terms are highlighted in titles and excerpts
- **Callbacks** — `onResults`, `onError`, `onSearchStart` for tight integration
- **Zero host dependencies** — React is bundled, no global React needed
- **CSS-scope prefix** — `doc-search-*` classes avoid collisions

## Install

```bash
# Clone and build
git clone https://github.com/nicosia/document-search.git
cd document-search
npm install
npm run build

# Or use via CDN (after publishing)
<script type="module" src="https://cdn.jsdelivr.net/npm/@nicosia/document-search@1/dist/document-search.js"></script>
```

## Usage

### Basic

```html
<script type="module" src="document-search.js"></script>

<document-search
  api-url="https://your-api.com/search"
  placeholder="Cerca documenti..."
  page-size="10"
  debounce-ms="300"
></document-search>
```

### With Auth Headers

```js
const el = document.querySelector('document-search');
el.searchHeaders = { Authorization: 'Bearer YOUR_TOKEN' };
```

### With Event Listeners

```js
const el = document.querySelector('document-search');
el.addEventListener('results', (e) => {
  console.log('Results:', e.detail); // DocumentSearchResult[]
});
el.addEventListener('error', (e) => {
  console.error('Search error:', e.detail);
});
```

## API Response Format

The component expects the API to return a JSON array (or an object with `results`/`items` key):

```json
[
  {
    "id": "1",
    "title": "Documento esempio",
    "excerpt": "Contenuto che corrisponde alla ricerca...",
    "url": "https://example.com/doc/1",
    "date": "2025-03-01"
  }
]
```

## CMS Integration

### WordPress

```php
// functions.php or a custom plugin
add_action('wp_enqueue_scripts', function() {
  wp_enqueue_script(
    'document-search',
    get_template_directory_uri() . '/js/document-search.js',
    [], '1.0.0', true
  );
});
```

```html
<!-- In any page/post HTML editor -->
<document-search api-url="https://your-api.com/search" placeholder="Cerca nel sito..."></document-search>
```

### Joomla

```php
// In your template's index.php or a custom module
$doc = JFactory::getDocument();
$doc->addScript(JUri::root() . 'media/templates/site/your-template/js/document-search.js');
```

```html
<document-search api-url="https://your-api.com/search"></document-search>
```

### Drupal

```yaml
# MYTHEME.libraries.yml
document-search:
  version: 1.x
  js:
    js/document-search.js: {}
```

```html
<!-- In a block or Twig template -->
<document-search api-url="https://your-api.com/search"></document-search>
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `api-url` | string | required | Fulltext search API endpoint |
| `placeholder` | string | "Cerca documenti..." | Input placeholder |
| `page-size` | number | 10 | Results per page |
| `debounce-ms` | number | 300 | Typing debounce delay |
| `css-prefix` | string | "doc-search" | CSS class prefix |

## Props (TypeScript)

```ts
interface DocumentSearchProps {
  apiUrl: string;
  placeholder?: string;
  pageSize?: number;
  debounceMs?: number;
  cssPrefix?: string;
  headers?: Record<string, string>;
  onResults?: (results: DocumentSearchResult[], query: string) => void;
  onError?: (error: Error) => void;
  onSearchStart?: (query: string) => void;
}
```

## License

MIT
