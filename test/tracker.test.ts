import { describe, expect, test } from "bun:test"
import { DirtyTracker, runChecks, buildViolationMessage } from "../src/tracker.js"

describe("DirtyTracker", () => {
  test("marks code files and resolves relative paths against directory", () => {
    const t = new DirtyTracker("/work/proj")
    expect(t.mark("s1", "main.go")).toBe(true)
    expect(t.peek("s1")).toEqual(["/work/proj/main.go"])
  })

  test("keeps absolute paths as-is", () => {
    const t = new DirtyTracker("/work/proj")
    t.mark("s1", "/other/x.py")
    expect(t.peek("s1")).toEqual(["/other/x.py"])
  })

  test("ignores non-code files", () => {
    const t = new DirtyTracker("/work/proj")
    expect(t.mark("s1", "README.md")).toBe(false)
    expect(t.peek("s1")).toEqual([])
  })

  test("dedups repeated edits to the same file", () => {
    const t = new DirtyTracker("/work/proj")
    t.mark("s1", "a.go")
    t.mark("s1", "a.go")
    t.mark("s1", "a.go")
    expect(t.peek("s1")).toEqual(["/work/proj/a.go"])
  })

  test("isolates dirty sets per session", () => {
    const t = new DirtyTracker("/work/proj")
    t.mark("s1", "a.go")
    t.mark("s2", "b.py")
    expect(t.peek("s1")).toEqual(["/work/proj/a.go"])
    expect(t.peek("s2")).toEqual(["/work/proj/b.py"])
  })

  test("drain returns files and clears the set", () => {
    const t = new DirtyTracker("/work/proj")
    t.mark("s1", "a.go")
    t.mark("s1", "b.py")
    const drained = t.drain("s1")
    expect(drained.sort()).toEqual(["/work/proj/a.go", "/work/proj/b.py"])
    expect(t.peek("s1")).toEqual([])
  })

  test("drain on empty session returns empty array", () => {
    const t = new DirtyTracker("/work/proj")
    expect(t.drain("nope")).toEqual([])
  })
})

describe("runChecks", () => {
  test("collects only non-null (violation) reports", async () => {
    const files = ["a", "b", "c", "d"]
    const reports = await runChecks(files, 2, async (f) => (f === "b" || f === "d" ? `violation:${f}` : null))
    expect(reports.sort()).toEqual(["violation:b", "violation:d"])
  })

  test("checks every file exactly once", async () => {
    const files = ["a", "b", "c", "d", "e"]
    const seen: string[] = []
    await runChecks(files, 3, async (f) => {
      seen.push(f)
      return null
    })
    expect(seen.sort()).toEqual(["a", "b", "c", "d", "e"])
  })

  test("respects concurrency limit (never exceeds max in flight)", async () => {
    const files = Array.from({ length: 10 }, (_, i) => String(i))
    let inFlight = 0
    let maxInFlight = 0
    await runChecks(files, 3, async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return null
    })
    expect(maxInFlight).toBeLessThanOrEqual(3)
  })

  test("handles empty file list", async () => {
    const reports = await runChecks([], 5, async () => "x")
    expect(reports).toEqual([])
  })
})

describe("buildViolationMessage", () => {
  test("returns null for empty reports", () => {
    expect(buildViolationMessage([])).toBeNull()
  })

  test("builds a message containing all reports", () => {
    const msg = buildViolationMessage(["### a.go\nv1", "### b.py\nv2"])
    expect(msg).toContain("check-rules")
    expect(msg).toContain("a.go")
    expect(msg).toContain("b.py")
  })
})
