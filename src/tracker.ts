import path from "path"
import { isCodeFile } from "./core.js"

/**
 * Tracks which code files were touched per session since the last check,
 * and runs bounded-concurrency checks over a batch of files.
 *
 * Extracted from the plugin so the core behavior (dedup, code-file filtering,
 * drain-and-clear, concurrency) is testable without OpenCode runtime.
 */
export class DirtyTracker {
  private dirty = new Map<string, Set<string>>()

  constructor(private directory: string) {}

  /**
   * Record a touched file for a session. Relative paths are resolved against
   * the plugin directory. Non-code files are ignored. Returns true if the file
   * was actually recorded (i.e. it was a code file).
   */
  mark(sessionID: string, filePath: string): boolean {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(this.directory, filePath)
    if (!isCodeFile(abs)) return false
    const set = this.dirty.get(sessionID) ?? new Set<string>()
    set.add(abs)
    this.dirty.set(sessionID, set)
    return true
  }

  /** Return current dirty files for a session (absolute paths), without clearing. */
  peek(sessionID: string): string[] {
    return [...(this.dirty.get(sessionID) ?? [])]
  }

  /** Return dirty files for a session and clear the set. */
  drain(sessionID: string): string[] {
    const set = this.dirty.get(sessionID)
    if (!set) return []
    this.dirty.delete(sessionID)
    return [...set]
  }
}

/**
 * Run `checker` over `files` with bounded concurrency, collecting only the
 * results that represent violations (checker returns a string) rather than
 * "all clear" (checker returns null).
 */
export async function runChecks(
  files: string[],
  concurrency: number,
  checker: (file: string) => Promise<string | null>,
): Promise<string[]> {
  const reports: string[] = []
  let cursor = 0

  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor++]
      const result = await checker(file)
      if (result !== null) reports.push(result)
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), files.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return reports
}

/**
 * Build the conversation message injected when violations are found.
 * Returns null when there are no reports (nothing to inject).
 */
export function buildViolationMessage(reports: string[]): string | null {
  if (reports.length === 0) return null
  return [
    "## 规则检查发现违规（check-rules 自动检查）",
    "",
    "以下是本轮修改的代码文件中检测到的工程规则违规。请评估并修复：",
    "",
    ...reports,
  ].join("\n")
}
