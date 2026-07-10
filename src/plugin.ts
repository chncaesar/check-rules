import type { Plugin } from "@opencode-ai/plugin"
import { checkFile } from "./core.js"
import { DirtyTracker, runChecks, buildViolationMessage } from "./tracker.js"

/**
 * check-rules plugin (v2)
 *
 * Turns the v1 custom tool (which relied on the model *remembering* to call it)
 * into a deterministic, hook-driven check.
 *
 * Design: decouple "tracking dirty files" from "running the check".
 *
 *  - tool.execute.after (edit/write/patch): cheaply record the touched file
 *    into a per-session dirty set. Zero LLM calls, zero blocking. Editing the
 *    same file 100 times is still one entry (Set dedup). Mid-edits never trigger
 *    a check.
 *
 *  - event -> session.idle: the agent has finished a round of work and handed
 *    control back to the user. Only now do we batch-check the accumulated dirty
 *    files, inject violations back into the conversation (noReply, so we don't
 *    start a new agent loop), and clear the set.
 *
 * This avoids checking half-finished intermediate states, keeps cost at
 * ~one check per unit of work instead of per edit, and no longer depends on the
 * model choosing to call a tool.
 */

const WRITE_TOOLS = new Set(["edit", "write", "patch", "apply_patch"])
const CONCURRENCY = Number(process.env.CHECK_CONCURRENCY || "5")
const AUTO_ENABLED = process.env.CHECK_AUTO !== "false"

export type CheckRulesDeps = {
  /** Check one file; return a violation report, or null if compliant/skippable. */
  check?: (file: string) => Promise<string | null>
  concurrency?: number
  autoEnabled?: boolean
}

/** Default checker: run the real model check, filter out "all clear" results. */
async function defaultCheck(file: string): Promise<string | null> {
  const result = await checkFile(file)
  if (!result || result.includes("全部合规")) return null
  return `### ${file}\n${result}`
}

/**
 * Factory that builds the plugin with injectable dependencies. The default
 * export uses real deps; tests inject a fake checker to stay hermetic.
 */
export function createCheckRulesPlugin(deps: CheckRulesDeps = {}): Plugin {
  const check = deps.check ?? defaultCheck
  const concurrency = deps.concurrency ?? CONCURRENCY
  const autoEnabled = deps.autoEnabled ?? AUTO_ENABLED

  return async ({ client, directory }) => {
    const tracker = new DirtyTracker(directory)

    async function runIdleCheck(sessionID: string) {
      const files = tracker.drain(sessionID)
      if (files.length === 0) return

      const reports = await runChecks(files, concurrency, check)
      const message = buildViolationMessage(reports)
      if (!message) return

      // noReply: inject into conversation history so the agent sees it next turn,
      // but don't trigger a new agent loop now (avoids idle->prompt->idle loops).
      await client.session.prompt({
        path: { id: sessionID },
        body: {
          noReply: true,
          parts: [{ type: "text", text: message }],
        },
      })
    }

    return {
      "tool.execute.after": async (input) => {
        if (!autoEnabled) return
        if (!WRITE_TOOLS.has(input.tool)) return
        const filePath = input.args?.filePath || input.args?.path
        if (typeof filePath === "string" && filePath.length > 0) {
          tracker.mark(input.sessionID, filePath)
        }
      },

      event: async ({ event }) => {
        if (!autoEnabled) return
        if (event.type !== "session.idle") return
        await runIdleCheck(event.properties.sessionID)
      },
    }
  }
}

export const CheckRulesPlugin = createCheckRulesPlugin()
