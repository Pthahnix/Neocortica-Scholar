import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { paperContent } from "../../src/tools/paper_content.js";
import { saveMarkdown } from "../../src/utils/cache.js";

describe("paper_content", () => {
  let cacheDir: string;
  const originalCache = process.env.DIR_CACHE;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "ncs-content-"));
    process.env.DIR_CACHE = cacheDir;
  });

  afterEach(() => {
    process.env.DIR_CACHE = originalCache;
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("returns markdown content by normalizedTitle", () => {
    saveMarkdown("Test Paper", "# Hello\n\nThis is a test paper.");
    const result = paperContent({ normalizedTitle: "test_paper" });
    assert.ok(result);
    assert.equal(result!.content, "# Hello\n\nThis is a test paper.");
    assert.ok(result!.markdownPath.endsWith("test_paper.md"));
  });

  it("derives normalizedTitle from title when not provided", () => {
    saveMarkdown("My Great Paper", "# Content here");
    const result = paperContent({ title: "My Great Paper" });
    assert.ok(result);
    assert.equal(result!.content, "# Content here");
  });

  it("returns null when paper not cached", () => {
    const result = paperContent({ normalizedTitle: "nonexistent_paper" });
    assert.equal(result, null);
  });

  it("returns null when neither title nor normalizedTitle provided", () => {
    const result = paperContent({});
    assert.equal(result, null);
  });

  it("handles title with special characters", () => {
    saveMarkdown("BERT: Pre-training of Transformers", "# BERT content");
    const result = paperContent({ title: "BERT: Pre-training of Transformers" });
    assert.ok(result);
    assert.equal(result!.content, "# BERT content");
  });
});
