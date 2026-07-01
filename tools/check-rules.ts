import { tool } from "@opencode-ai/plugin"
import { existsSync, readFileSync } from "fs"
import path from "path"

const DOMAIN_MAP: Record<string, string[]> = {
  ".go": ["backend-go"],
  ".dart": ["mobile-flutter"],
  ".swift": ["ios-swift"],
  ".py": ["python"],
  ".c": ["embedded"],
  ".h": ["embedded"],
  ".cpp": ["embedded"],
  ".s": ["embedded"],
  ".rs": ["embedded"],
  ".sql": ["database"],
  ".yaml": ["devops"],
  ".yml": ["devops"],
  ".toml": ["devops"],
}

const RULES_DIR =
  process.env.ENGINEERING_BRAIN ||
  path.join(process.env.HOME || "~", ".config/opencode", "engineering-brain")

const MODEL = process.env.CHECK_MODEL || "deepseek-v4-flash"
const API_KEY = process.env.DEEPSEEK_API_KEY || ""
const API_BASE = process.env.CHECK_API_BASE || "https://api.deepseek.com"

function detectDomains(filePath: string): string[] {
  const ext = path.extname(filePath)
  const base = path.basename(filePath).toLowerCase()
  const domains: string[] = DOMAIN_MAP[ext] || []

  if (base.includes("migration") || base.includes("migrate")) {
    if (!domains.includes("database")) domains.push("database")
  }
  if (base.includes("llm") || base.includes("stream") || filePath.includes("llm")) {
    if (!domains.includes("llm-app")) domains.push("llm-app")
  }
  if (base === "dockerfile" || base.includes("docker-compose")) {
    if (!domains.includes("devops")) domains.push("devops")
  }

  if (domains.length === 0) domains.push("unknown")
  return domains
}

function loadRules(domains: string[]): string {
  const parts: string[] = []

  const constPath = path.join(RULES_DIR, "constitution.md")
  if (existsSync(constPath)) {
    parts.push("== 工程宪法（始终适用）==\n" + readFileSync(constPath, "utf-8"))
  }

  for (const domain of domains) {
    const ruleFile = path.join(RULES_DIR, `${domain}.md`)
    if (existsSync(ruleFile)) {
      parts.push(`\n== ${domain} 领域规则 ==\n` + readFileSync(ruleFile, "utf-8"))
    }
  }

  return parts.join("\n---\n")
}

async function checkWithModel(code: string, rules: string, filePath: string): Promise<string> {
  if (!API_KEY) {
    return "错误: 未设置 DEEPSEEK_API_KEY 环境变量。请在 opencode.json 或 shell profile 中配置。"
  }

  const systemPrompt = `你是工程规则检查器。任务是审查代码是否违反下面列出的工程规则。

逐条检查每条规则，输出:
- 违规: 违反了什么规则 + 在代码的哪个位置
- 合规: 全部通过则输出「全部合规」

不要输出其他内容。`

  const userPrompt = `## 文件路径
${filePath}

## 工程规则
${rules}

## 代码开始
${code}
## 代码结束`

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  }

  const resp = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "")
    return `API 错误 (${resp.status}): ${errText.slice(0, 300)}`
  }

  const data = await resp.json() as any
  return data.choices?.[0]?.message?.content || "（无返回）"
}

export default tool({
  description: "用轻量模型检查代码是否违反用户工程规则。仅在写完代码后调用。",
  args: {
    filePath: tool.schema.string().describe("要检查的文件路径（从当前工作目录的相对路径或绝对路径）"),
  },
  async execute(args: { filePath: string }, ctx: { directory: string }) {
    const filePath = path.isAbsolute(args.filePath)
      ? args.filePath
      : path.join(ctx.directory, args.filePath)

    if (!existsSync(filePath)) {
      return `文件不存在: ${filePath}`
    }

    const code = readFileSync(filePath, "utf-8")
    const domains = detectDomains(filePath)
    const rules = loadRules(domains)

    const result = await checkWithModel(code, rules, filePath)
    return `### 规则检查: ${filePath}
${result}`
  },
})
