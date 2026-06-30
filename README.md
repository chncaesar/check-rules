# check-rules

A lightweight OpenCode custom tool that checks generated code against personal engineering rules using a cheap model (default: DeepSeek V4 Flash).

**Motivation**: Coding agents (even strong ones like DeepSeek V4 Pro) frequently violate personal engineering preferences — using `double` for money, writing business logic in SwiftUI Views, omitting `COMMENT ON` in migrations, etc. Input-side rule injection helps but has a ~40% compliance ceiling. This tool provides a **post-generation check** to catch the remaining violations.

For the full design context, see [DESIGN.md](https://github.com/chncaesar/opencode-engineering-brain).

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

Then, when OpenCode generates code, the model will automatically run `check-rules(filePath: "path/to/file")` and show any violations found. You can also call it manually by typing "检查一下" or "check this file".

## How It Works

1. The tool reads the file from disk (after it's been written by the coding model)
2. It detects the domain from file extension (`.go` → backend-go, `.dart` → mobile-flutter, etc.)
3. It loads the relevant engineering rules from the rules directory
4. It sends the code + rules to a cheap model (e.g., DeepSeek V4 Flash) for checking
5. Results are returned to the conversation — the coding model can self-correct, or you review them

## Rules

The rules directory contains domain-specific engineering rules in a decision-rules format:

- `constitution.md` — universal rules that always apply (grep-first, single-source-of-truth, discuss-first, etc.)
- `backend-go.md` — Go backend rules (no ORM, error wrapping)
- `database.md` — database rules (money as int cents, no drop+recreate, COMMENT required)
- `embedded.md` — embedded/serial rules (binary protocol, no JSON, timeout+retry)
- `ios-swift.md` — iOS/SwiftUI rules (ViewModel pattern, clean error messages)
- `mobile-flutter.md` — Flutter/Dart rules (money int, Drift invalidate before pop)
- `python.md` — Python rules (logging no print, DRY, style)
- `llm-app.md` — LLM app rules (streaming, SSE)
- `devops.md` — DevOps rules (no docker-compose DB in prod, /health endpoint)

Customize these to match your own engineering preferences.

## License

MIT
