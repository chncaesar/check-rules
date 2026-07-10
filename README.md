# check-rules

A lightweight OpenCode **plugin + tool** that checks generated code against personal engineering rules using a cheap model (default: DeepSeek V4 Flash).

- **Plugin (v2, automatic):** runs the check deterministically when the agent finishes a round of work — no reliance on the model remembering to call anything.
- **Tool (v1, manual):** still available for on-demand "check this file" invocation.

Both share the same core logic (domain detection, rule loading, model check).

## Why This Tool Exists

### The Problem with Deepseek V4 Pro

If you use a cheap coding model (like DeepSeek V4 Pro) in daily development, you've probably experienced this: it writes code confidently but frequently violates basic engineering rules — using `double` for money amounts, writing network requests inside SwiftUI Views, omitting `COMMENT ON` in database migrations, and so on. You end up manually catching and correcting the same classes of violations over and over.

### What We Tried First: Input-Side Rule Injection

The obvious first approach is to write your engineering rules into the system prompt (AGENTS.md) and let the model read them before writing code. We tested this thoroughly.

**Experiment 1: Strong-guidance markdown with index table**
We put a constitution + domain-rule index table in AGENTS.md with explicit instructions: "Before writing any code, you MUST first read the relevant domain rule file."

| Metric | Result |
|--------|--------|
| Tasks | 5 (Flutter/money, Go/DB, SwiftUI/View, serial/embedded, DB migration) |
| Runs per task | 2 |
| **Rule file reading rate** | **10/10 (100%)** ✅ The model *always* read the rules |
| **Rule compliance rate** | **5/10 (50%)** ❌ Half the time it violated rules anyway |

Even more, of the 5 violations, *all* were cases where the model had read the rules and still broke them.

**Experiment 2: Expanded to 12 tasks across all domains**

| Metric | Result |
|--------|--------|
| Tasks | 12 covering Go, Python, Flutter, SwiftUI, embedded, DB, LLM, DevOps |
| **Reading rate** | **12/13 (92%)** ✅ |
| **Compliance rate** | **4/13 (31%)** ❌ |

### The Key Insight

> **The model knows the rules. It reads them almost every time. It just doesn't follow them.**

The problem is not "input-side injection failed" — it's that the model's internal decision-making doesn't reliably translate "I read the rule" into "I apply the rule." This is a fundamental model capability gap, especially pronounced in cheaper models. No amount of prompt engineering fixes it.

### The Solution: Lightweight Post-Generation Check

Instead of trying to make the model innately compliant (we can't), we **check its output** after it writes code. A cheap model (DeepSeek V4 Flash, ~$0.30/M tokens) reviews the generated code against the same rule set and flags violations. The results go back into the conversation — the coding model can self-correct, or you review them.

This catches what input-side injection misses.

## v2: From Tool to Plugin

v1 shipped as a custom tool. It worked, but had a fundamental weakness the original README admitted:

> **It relies on the model choosing to call the tool.** Cheap models read rule *files* reliably (~97%, a native high-frequency action), but calling a *custom tool* is less familiar, so compliance is lower. A strong-constraint prompt raises the probability but — like MCP tool selection — **cannot guarantee** the model always calls it.

v1 also named the only reliable fix: a plugin hook that runs the check regardless of whether the model remembers. v2 implements exactly that.

### The design problem: *when* to check, not *whether*

The naive plugin design — "check after every `edit`/`write`" — is wrong, for three reasons:

1. **It destroys flow.** Most edits during development are intermediate (writing half of something, debugging, iterating). Checking every edit constantly interrupts.
2. **It's expensive.** With ~1300 edits/month in real usage, a check per edit means ~1300 LLM calls, most against half-finished code.
3. **It floods false positives.** Checking half-written code reports "violations" that are just incomplete work.

**So don't check at the edit boundary — check at the completion boundary.**

### The solution: decouple tracking from checking

- **`tool.execute.after` (edit/write/patch):** cheaply record the touched file into a per-session "dirty set". Zero LLM calls, zero blocking. Editing the same file 100 times is one entry (Set dedup). Mid-edits never trigger a check.
- **`session.idle`:** the agent has finished a round of work and handed control back to you — i.e. *code is written, not yet tested*. Only now does the plugin batch-check the accumulated dirty files, inject any violations back into the conversation (with `noReply`, so it doesn't kick off a new agent loop), and clear the set.

Result: checks run at ~one per unit of work instead of per edit, never against intermediate states, and no longer depend on the model remembering to call a tool. See [`DESIGN.md`](./DESIGN.md) for the full design.

## Installation

### Plugin (recommended — automatic)

```bash
# 1. Point OpenCode's engineering-brain at this repo's rules (single source of truth)
ln -s "$(pwd)/rules" ~/.config/opencode/engineering-brain

# 2. Set your API key
echo 'export DEEPSEEK_API_KEY="sk-your-key"' >> ~/.zshrc
source ~/.zshrc
```

Then reference the plugin by file path in your `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugin": ["/absolute/path/to/check-rules/src/plugin.ts"]
}
```

The plugin auto-checks code files whenever the agent goes idle. No AGENTS.md constraint needed.

### Tool (optional — manual fallback)

```bash
cp tools/check-rules.ts ~/.config/opencode/tools/check-rules.ts
```

Lets you (or the model) trigger a check on demand: "check this file" / "检查一下".

Rules are read from `ENGINEERING_BRAIN` (default `~/.config/opencode/engineering-brain`). All rule files live flat in one directory: `constitution.md` plus one `<domain>.md` per domain.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `DEEPSEEK_API_KEY` | (required) | DeepSeek API key for the checker model |
| `CHECK_MODEL` | `deepseek-v4-flash` | Model ID to use for checking |
| `CHECK_API_BASE` | `https://api.deepseek.com` | API base URL |
| `ENGINEERING_BRAIN` | `~/.config/opencode/engineering-brain` | Path to rules directory |
| `CHECK_AUTO` | `true` | Set to `false` to disable the plugin's automatic checking |
| `CHECK_CONCURRENCY` | `5` | Max files checked in parallel on idle |

## Usage

With the **plugin** installed, checking is automatic — edit code, and when the agent finishes a round of work, violations (if any) are injected into the conversation for the agent to fix or for you to review.

With only the **tool** installed, add a strong, non-skippable constraint to your `~/.config/opencode/AGENTS.md` so the model remembers to call it:

```markdown
## Code Check (mandatory, do not skip)

After every write/edit to a code file, you MUST immediately:

1. Call check-rules on the file you just wrote (pass its path).
2. If check-rules reports violations, fix ALL of them before continuing.
3. Re-run check-rules to confirm it passes.

Do NOT claim a task is complete without running check-rules. Do NOT skip the
check on the grounds that "the code is simple" or "I'm sure it's fine."
```

## Development

```bash
bun install
bun test          # unit + integration tests (hermetic, no API calls)
bunx tsc --noEmit # typecheck
```

## Verification Methodology

The README's opening claims are based on two controlled probes run against DeepSeek V4 Pro. The full methodology is open-sourced in [`benchmark/`](./benchmark/):

- **`tasks.json`** — 12 task definitions covering Go, Python, Flutter, SwiftUI, embedded, DB, LLM, and DevOps domains. Each task has known violation patterns with regex-based detectors.
- **`analyze.py`** — Takes OpenCode `--format json` output files and produces a four-quadrant analysis (read+comply / read+violate / no-read+comply / no-read+violate).

To reproduce:
```bash
# 1. Isolate your global AGENTS.md to avoid pollution
# 2. Run each task with strong guidance:
opencode run --format json --pure -m deepseek/deepseek-v4-pro "$TASK" > output.jsonl
# 3. Analyze
python benchmark/analyze.py ./runs benchmark/tasks.json
```

## How It Works

Both plugin and tool share the same core check (`src/core.ts`):

1. Read the file from disk (after it's been written by the coding model)
2. Detect the domain from file extension (`.go` → backend-go, `.dart` → mobile-flutter, etc.)
3. Load the relevant engineering rules from the rules directory
4. Send the code + rules to a cheap model (e.g., DeepSeek V4 Flash) for checking
5. Return results to the conversation — the coding model can self-correct, or you review them

The **plugin** wraps this with dirty-file tracking (`src/tracker.ts`) and fires it on `session.idle`; the **tool** invokes it directly on demand.

## Rules

The rules directory contains domain-specific engineering rules. Each rule follows a decision-rules format with five elements: **scenario, do, don't, reason, example**.

- `constitution.md` — universal rules that always apply
- `backend-go.md` — Go backend rules
- `database.md` — database rules (money as int cents, no drop+recreate, COMMENT required)
- `embedded.md` — embedded/serial rules (binary protocol, no JSON, timeout+retry)
- `ios-swift.md` — iOS/SwiftUI rules (ViewModel pattern, clean error messages)
- `mobile-flutter.md` — Flutter/Dart rules (money int, Drift invalidate before pop)
- `python.md` — Python rules (logging no print, DRY, style)
- `llm-app.md` — LLM app rules (streaming, SSE, no buffering)
- `devops.md` — DevOps rules (/health endpoint)

Customize these to match your own engineering preferences.

## License

MIT
