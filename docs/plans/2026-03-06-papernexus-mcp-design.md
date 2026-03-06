# papernexus-mcp Design

**Date:** 2026-03-06
**Status:** Approved

---

## Summary

Extract academic paper tooling from Neocortica monolith into an independent MCP server (`papernexus-mcp`) in a separate repository. Neocortica retains only the skill/prompt orchestration layer; web search tools are removed entirely (replaced by official brave/tavily MCPs at the skill level).

---

## Project Structure

```
papernexus-mcp/
├── src/
│   ├── mcp_server.ts           # MCP registration for 4 tools
│   ├── types.ts                # PaperMeta type
│   ├── tools/
│   │   ├── paper_searching.ts  # Tool 1: metadata enrichment
│   │   ├── paper_fetching.ts   # Tool 2: fetch markdown
│   │   ├── paper_references.ts # Tool 3: extract & search references
│   │   └── paper_reading.ts    # Tool 4: AI paper reader (stub)
│   └── utils/
│       ├── arxiv.ts            # arXiv API + arxiv2md
│       ├── ss.ts               # Semantic Scholar API
│       ├── unpaywall.ts        # Unpaywall OA lookup
│       ├── pdf.ts              # MinerU PDF -> markdown
│       ├── cache.ts            # Local cache (markdown + meta JSON)
│       └── misc.ts             # normTitle etc.
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Types

```ts
interface PaperMeta {
  title: string;
  normalizedTitle: string;
  // identifiers
  arxivId?: string;
  doi?: string;
  s2Id?: string;
  // metadata
  abstract?: string;       // paper_searching guarantees this when possible
  arxivUrl?: string;
  oaPdfUrl?: string;        // merged from pdfUrl / openAccessPdf
  year?: number;
  authors?: string;
  citationCount?: number;
  sourceUrl?: string;
  // cache
  markdownPath?: string;    // paper_fetching populates this
}
```

---

## Tools

### Tool 1: paper_searching

**Purpose:** Accept raw output from apify Google Scholar scraper, enrich into full PaperMeta.

**Input:** Single apify scraper result (title, link, authors, year, citations, searchMatch, documentLink).

**Flow:**
1. Parse base fields from apify output (title, year, authors, citationCount, sourceUrl)
2. Check if `link` already contains an arxivUrl
3. Call Semantic Scholar `search/match` -> get abstract, s2Id, doi, arxivUrl, oaPdfUrl
4. If SS has no arxivUrl -> call arXiv API title search
5. If has doi but no oaPdfUrl -> call Unpaywall for OA PDF URL
6. Return complete PaperMeta

**Note:** paper_references reuses the same underlying enrichment logic with title-only input (skips apify parsing, starts from step 3).

### Tool 2: paper_fetching

**Purpose:** Given PaperMeta with arxivUrl or oaPdfUrl, fetch full paper as markdown.

**Input:** Full PaperMeta object.

**Flow:**
1. Check local cache by `normalizedTitle` -> if cached, return markdownPath
2. Has arxivUrl -> call arxiv2md.org API -> save markdown
3. Has oaPdfUrl -> call MinerU API -> PDF to markdown -> save
4. Neither -> return PaperMeta with empty markdownPath (no full text available)
5. Update meta JSON in cache

### Tool 3: paper_references

**Purpose:** Extract cited references from paper markdown, search metadata for each.

**Input:** markdownPath (path to paper markdown file).

**Flow:**
1. Read markdown, locate References / Bibliography section
2. Parse each citation entry, extract title (regex + heuristics)
3. For each title, call paper_searching's underlying function (SS -> arXiv -> Unpaywall)
4. Return PaperMeta[] (enriched metadata for each reference)

### Tool 4: paper_reading (stub)

**Purpose:** AI agent reads paper markdown, returns structured summary.

**Status:** Stub only. Returns "not implemented" placeholder.

**Future:** Will call Claude API internally with prompt template, return structured reading notes.

---

## Data Flow in Skill Orchestration

```
┌─────────────────── Skill Layer (literature-survey.md) ────────────────┐
│                                                                       │
│  1. apify MCP: google_scholar_scraper(query)                         │
│     └→ raw items[]                                                    │
│                                                                       │
│  2. papernexus: paper_searching(item)    <- per item                 │
│     └→ PaperMeta[] (abstract, arxivUrl?, oaPdfUrl?)                  │
│                                                                       │
│  3. CC rates by abstract: high / medium / low                        │
│                                                                       │
│  4. papernexus: paper_fetching(meta)     <- medium + high            │
│     └→ PaperMeta (with markdownPath)                                 │
│                                                                       │
│  5. papernexus: paper_reading(path)      <- medium + high (future)   │
│     └→ structured summary (saves CC tokens)                          │
│                                                                       │
│  6. CC decides whether to deep-read -> Read markdownPath directly    │
│                                                                       │
│  7. papernexus: paper_references(path)   <- high-rated papers only   │
│     └→ PaperMeta[] (reference metadata)                              │
│     └→ loop back to step 3                                           │
└───────────────────────────────────────────────────────────────────────┘
```

**Key decisions:**
- paper_searching does NOT call apify — apify is an external MCP, invoked at skill level
- paper_fetching does NOT search — it only accepts PaperMeta with existing URLs
- paper_references reuses paper_searching logic at code level, not via MCP self-call

---

## Dependencies

**dependencies:**
```json
{
  "@modelcontextprotocol/sdk": "^1.26.0",
  "fast-xml-parser": "^5.3.7",
  "adm-zip": "^0.5.16",
  "zod": "^4.3.6",
  "dotenv": "^17.3.1"
}
```

**devDependencies:**
```json
{
  "@types/adm-zip": "^0.5.7",
  "@types/node": "^25.3.0",
  "tsx": "^4.21.0",
  "typescript": "^5.9.3"
}
```

No node-fetch — uses Node 18+ native fetch.

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `TOKEN_MINERU` | MinerU PDF OCR | Yes (paper_fetching PDF path) |
| `EMAIL_UNPAYWALL` | Unpaywall OA lookup | Yes (paper_searching fallback) |
| `DIR_CACHE` | Cache directory, default `.cache/` | No |

---

## Scripts

```json
{
  "mcp": "tsx src/mcp_server.ts",
  "test": "tsx --test src/**/*.test.ts",
  "build": "tsc"
}
```

---

## Migration Strategy

1. **Phase 1:** Create papernexus-mcp as independent repo, implement fully, test
2. **Phase 2:** After confirmed working, update Neocortica:
   - Remove `src/tools/academic.ts`, `src/tools/markdown.ts`, `src/tools/web.ts`
   - Remove `src/utils/arxiv.ts`, `src/utils/ss.ts`, `src/utils/unpaywall.ts`, `src/utils/pdf.ts`, `src/utils/apify.ts`, `src/utils/brave.ts`, `src/utils/web.ts`, `src/utils/markdown.ts`
   - Update `.mcp.json` to point to papernexus-mcp
   - Update skills to use new tool names

---

## Code Reuse from Neocortica

| Source file | Target | Changes |
|-------------|--------|---------|
| `src/utils/arxiv.ts` | `utils/arxiv.ts` | Remove `dotenv/config`, remove `node-fetch` import |
| `src/utils/ss.ts` | `utils/ss.ts` | Remove `dotenv/config` |
| `src/utils/unpaywall.ts` | `utils/unpaywall.ts` | Remove `dotenv/config` |
| `src/utils/pdf.ts` | `utils/pdf.ts` | Remove `dotenv/config`, remove `node-fetch` import |
| `src/utils/markdown.ts` | `utils/cache.ts` | Rename, remove web-related functions |
| `src/utils/misc.ts` | `utils/misc.ts` | Direct copy |
| `src/types.ts` | `types.ts` | PaperResult -> PaperMeta, field renames |

---

**End of Design Document**
