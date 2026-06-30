# check-rules

A lightweight OpenCode custom tool that checks generated code against personal engineering rules using a cheap model (default: DeepSeek V4 Flash).

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

## Installation

```bash
# 1. Copy the tool to OpenCode's custom tools directory
cp tools/check-rules.ts ~/.config/opencode/tools/check-rules.ts

# 2. Copy the default rules (optional, customize your own)
cp -r rules ~/.config/opencode/engineering-brain/rules

# 3. Set your API key
echo 'export DEEPSEEK_API_KEY="sk-your-key"' >> ~/.zshrc
source ~/.zshrc
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `DEEPSEEK_API_KEY` | (required) | DeepSeek API key for the checker model |
| `CHECK_MODEL` | `deepseek-v4-flash` | Model ID to use for checking |
| `CHECK_API_BASE` | `https://api.deepseek.com` | API base URL |
| `ENGINEERING_BRAIN` | `~/.config/opencode/engineering-brain` | Path to rules directory |

## Usage

Add this to your `~/.config/opencode/AGENTS.md`:

```markdown
After writing code, call check-rules to verify it doesn't violate engineering rules.
```

Then, when OpenCode generates code, the model will automatically run `check-rules(filePath: "path/to/file")` and show any violations found. You can also call it manually by typing "check this file" or "检查一下".

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

1. The tool reads the file from disk (after it's been written by the coding model)
2. It detects the domain from file extension (`.go` → backend-go, `.dart` → mobile-flutter, etc.)
3. It loads the relevant engineering rules from the rules directory
4. It sends the code + rules to a cheap model (e.g., DeepSeek V4 Flash) for checking
5. Results are returned to the conversation — the coding model can self-correct, or you review them

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
