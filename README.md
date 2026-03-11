# Neocortica-Scholar

A component of [Neocortica](https://github.com/Pthahnix/Neocortica) — an MCP server for academic paper searching, fetching, reading, and reference exploration.

## Tools

| Tool | Description |
| ---- | ----------- |
| `paper_searching` | Enrich a Google Scholar result with metadata from arXiv, Semantic Scholar, and Unpaywall |
| `paper_fetching` | Fetch full paper as markdown: cache → local PDF → arxiv2md → MinerU |
| `paper_content` | Read cached paper markdown by title (local, no network) |
| `paper_reference` | Get paper references via Semantic Scholar API, fallback to markdown parsing |
| `paper_reading` | AI-powered three-pass paper reader via LLM agent (Keshav method) |

## Setup

```bash
npm install
cp .env.example .env
# Fill in your API keys in .env
```

## Usage

```bash
npm run mcp          # Start MCP server (stdio transport)
npm test             # Run tests
npm run build        # Compile TypeScript
```

## Environment Variables

| Variable | Purpose | Required |
| -------- | ------- | -------- |
| `TOKEN_MINERU` | MinerU PDF→markdown API | Yes |
| `EMAIL_UNPAYWALL` | Unpaywall OA PDF lookup | Yes |
| `DIR_CACHE` | Cache directory (default: `.cache/`) | No |
| `AGENT_MODEL` | LLM model for paper_reading (default: `openai/gpt-oss-120b`) | No |
| `OPENROUTER_API_KEY` | OpenRouter API key for paper_reading | For paper_reading |

## Architecture

```text
apify MCP (external) --> paper_searching --> paper_fetching --> paper_content
                                                            \
                                              paper_reference --> paper_searching (enrich)
                                                            \
                                              paper_reading (LLM three-pass)
```

### Pipeline: paper_searching

Priority: arXiv > Semantic Scholar > Unpaywall.

```text
input → has arxivUrl? ── yes → done
              │ no
              ▼
    arXiv title search? ── yes → arxivUrl → done
              │ no
              ▼
    SS title search? ── yes → Unpaywall DOI lookup → oaPdfUrl
              │ no                 │ no
              ▼                    ▼
            null                 done
```

### Pipeline: paper_fetching

```text
input → cache hit? ── yes → return cached
            │ no
            ▼
    pdfPath? ── yes → MinerU (local PDF)
            │ no
            ▼
    arxivUrl? ── yes → arxiv2md
            │ no
            ▼
    oaPdfUrl? ── yes → MinerU (remote PDF)
            │ no
            ▼
    return without markdownPath
```

### Known limitations

- **arxiv2md**: Some arXiv papers cannot be converted (complex LaTeX, very long papers).
- **oaPdfUrl via MinerU**: URLs from Unpaywall/SS that are DOI redirects (`doi.org/...`) may resolve to HTML landing pages or paywalls instead of actual PDFs, causing MinerU extraction to fail.

## MCP Test Results (v0.2.0, 80 LLM papers)

| Stage | Result |
| ----- | ------ |
| Scholar scrape | 80 papers (79 unique) |
| paper_searching | 63/79 have OA (79.7%) |
| paper_fetching | 58/63 succeeded (92.1%) |
| arxiv2md failures | 2 (arxiv2md conversion limit) |
| oaPdfUrl failures | 3 (DOI redirect → HTML/paywall) |

## License

Apache License 2.0
