import { tool } from "@opencode-ai/plugin"
import path from "path"
import { existsSync } from "fs"
import { checkFile } from "../src/core.js"

/**
 * check-rules custom tool (manual / model-invoked path).
 *
 * The plugin (src/plugin.ts) handles automatic checking on session.idle.
 * This tool remains as a manual fallback: the user can say "check this file"
 * or the model can call it explicitly. Both share the same core logic.
 */
export default tool({
  description: "用轻量模型检查代码是否违反用户工程规则。仅在写完代码后调用。",
  args: {
    filePath: tool.schema.string().describe("要检查的文件路径（从当前工作目录的相对路径或绝对路径）"),
  },
  async execute(args: { filePath: string }, ctx: { directory: string }) {
    const filePath = path.isAbsolute(args.filePath) ? args.filePath : path.join(ctx.directory, args.filePath)

    if (!existsSync(filePath)) {
      return `文件不存在: ${filePath}`
    }

    const result = await checkFile(filePath)
    return `### 规则检查: ${filePath}\n${result}`
  },
})
