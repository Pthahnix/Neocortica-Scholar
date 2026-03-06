# Neocortica

Vibe Researching Toolkit — academic paper search, web search, retrieval, deep reference exploration, and experiment execution.

## Architecture (v0.7.0 - Single Repository)

Single TypeScript project with MCP server + external MCPs:

### Core Structure

| Component | Purpose | Key Files |
|-----------|---------|-----------|
| MCP Server | Tool registration and orchestration | `src/mcp_server.ts` |
| Tools | Academic search, web search, markdown conversion | `src/tools/*.ts` |
| Utils | API wrappers (arXiv, Semantic Scholar, MinerU, etc.) | `src/utils/*.ts` |
| Supervisor | Remote execution HTTP service | `src/supervisor/*.ts` |
| Skills | Research workflow SOPs | `skill/*.md` |
| Prompts | LLM prompt templates | `prompt/*.md` |

### External MCP Servers

| Server | Package | Purpose |
|--------|---------|---------|
| `runpod` | `@runpod/mcp-server` | GPU pod lifecycle (create/start/stop/delete) |
| `apify` | `@apify/mcp-server` | Web scraping and data extraction |
| `brave` | `@brave/mcp-server` | Web search API |
| `tavily` | `@tavily/mcp-server` | AI-optimized search |

### Supervisor (`src/supervisor/`)

Standalone Express 5 HTTP service deployed on RunPod pods. Mediates async communication between local Claude Code and a remote Claude Code instance.

| File | Purpose |
|------|---------|
| `types.ts` | Shared types (TaskPayload, TaskStatus, Report, Feedback, HealthInfo) |
| `transport.ts` | Abstract ITransport interface (future-proofing for Redis/RabbitMQ) |
| `state.ts` | Persist task state to `/workspace/supervisor/state.json` |
| `process.ts` | ProcessManager — spawn/resume/kill CC child process, watch outbox |
| `server.ts` | Express HTTP server with 7 endpoints |

Endpoints: `GET /health`, `POST /task`, `GET /task/:id/status`, `GET /task/:id/report`, `POST /task/:id/feedback`, `GET /task/:id/files/*path`, `POST /task/:id/abort`

## MCP Tools

| Tool | Description |
| ---- | ----------- |
| `paper_content` | Convert paper to markdown (arXiv URL, PDF, or title → smart routing) |
| `acd_search` | Academic search via Google Scholar → fetch full text → cache |
| `dfs_search` | Deep reference exploration via DFS (Semantic Scholar references) |
| `web_search` | Search the web via Brave Search API |
| `web_content` | Fetch a web page as markdown and cache it |

External tools via official MCPs: web search (brave, tavily), scraping (apify), pod lifecycle (runpod)

## Research Workflow (v0.7.0 - Full Pipeline)

Five-stage pipeline — from topic to experiment results:

| Stage | Skill | Max Iterations | Target |
|-------|-------|----------------|--------|
| 1. Literature Survey | `skill/literature-survey.md` | 10 | 50 papers |
| 2. Gap Analysis | `skill/gap-analysis.md` | 6 | 30 papers |
| 3. Idea Generation | `skill/idea-generation.md` | 5 | 3 ideas |
| 4. Experiment Design | `skill/experiment-design.md` | 4 | complete plan |
| 5. Experiment Execution | `skill/experiment-execution.md` | 7 phases | experiment results |

**Loop Structure**:
```
WHILE (gaps.length > 0 AND iteration < MAX_ITERATIONS):
  SEARCH: 3 queries × 2 tools = 6 parallel searches (paper_content + web_search)
  READ: Top 8-12 papers, three-pass reading (High/Medium/Low rating)
  REFLECT: Discover new gaps via reflect-gaps.md → update knowledge
  EVALUATE: Judge sufficiency via evaluate-answer.md → remove completed gaps
  STOP CHECK: gaps cleared? no progress for 3 rounds? target reached?
END LOOP
```

**Key Features**:
- State inheritance: knowledge + papersRead passed between stages
- Dynamic stopping: autonomous gap discovery and completion detection
- Zero external validation cost
- Parallel search: 6 searches per iteration for multi-angle coverage

**Prompts**: `prompt/paper-reading.md`, `prompt/paper-rating.md`, `prompt/idea-scoring.md`, `prompt/reflect-gaps.md`, `prompt/evaluate-answer.md`, `prompt/hardware-estimation.md`, `prompt/environment-setup.md`, `prompt/experiment-task.md`

## Development Methodology: Incremental + Carpet-Bombing Tests

**MANDATORY** — all projects under Neocortica follow this development methodology:

1. **Single-file component** → immediately write unit tests, run and pass before moving on
2. **Multiple components form a feature** → immediately write feature-level integration tests
3. **Multiple features form a module** → immediately write module-level tests
4. **ALL prior tests must pass** before developing the next component — no exceptions
5. **Simulation tests required** — not just trivial "does it exist" checks. Generate realistic fake data that mimics real-world scenarios (fake API responses, edge cases, malformed inputs, realistic paper metadata, etc.) and verify the code works under realistic conditions
6. **Test files** live alongside source as `*.test.ts` (e.g., `src/utils/cache.test.ts`)
7. **Gate rule**: if any test fails, STOP. Fix the failure before writing new code

```
Component A → unit test A → PASS ✓
Component B → unit test B → PASS ✓
  → Feature test (A+B) → PASS ✓
Component C → unit test C → PASS ✓
  → Feature test (A+B+C) → PASS ✓
    → Module test (all) → PASS ✓
      → Continue to next module
```

## Key Conventions

- Single repository structure with `src/`, `skill/`, `prompt/` directories
- Output filenames: lowercase, non-alphanum → `_`, no trailing `_`
- Cache: `DIR_CACHE` from `.env` (default `.cache/`), subdirs `markdown/`, `paper/`, `web/`
- Prompts: `prompt/<name>.md` — LLM prompt templates
- Skills: `skill/<name>.md` — research SOPs

## Dev Commands

```bash
npm install               # Install dependencies
npm run mcp               # Run MCP server
npm test                  # Run tests
npm run build:supervisor  # Build supervisor only
npm run docker:build      # Build Docker image
npm run docker:push       # Push Docker image
```

## Environment

- Node.js (ESM, `tsx` for TS execution), npm
- `.env` holds `DIR_CACHE`, `TOKEN_MINERU`, `TOKEN_APIFY`, `TOKEN_BRAVE`, `EMAIL_UNPAYWALL`, `API_KEY_RUNPOD`
