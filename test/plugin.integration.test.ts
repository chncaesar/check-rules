import { describe, expect, test } from "bun:test"
import { createCheckRulesPlugin } from "../src/plugin.js"

/**
 * Integration test: exercises the plugin's two hooks end-to-end with a fake
 * OpenCode client and an injected fake checker, verifying the
 * tracking -> idle -> inject pipeline without any real API calls.
 */

function makeFakeClient() {
  const prompts: any[] = []
  return {
    prompts,
    client: {
      session: {
        prompt: async (opts: any) => {
          prompts.push(opts)
          return { data: {} }
        },
      },
    } as any,
  }
}

// A checker that flags any file whose name contains "bad".
const fakeCheck = async (file: string) => (file.includes("bad") ? `### ${file}\nviolation` : null)

describe("CheckRulesPlugin integration", () => {
  test("does not inject when no dirty files accumulated", async () => {
    const fake = makeFakeClient()
    const hooks = await createCheckRulesPlugin({ check: fakeCheck })({
      client: fake.client,
      directory: "/tmp/proj",
    } as any)
    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })
    expect(fake.prompts.length).toBe(0)
  })

  test("ignores non-write tools", async () => {
    const fake = makeFakeClient()
    const hooks = await createCheckRulesPlugin({ check: fakeCheck })({
      client: fake.client,
      directory: "/tmp/proj",
    } as any)
    await hooks["tool.execute.after"]!(
      { tool: "read", sessionID: "s1", callID: "c1", args: { filePath: "bad.go" } } as any,
      { title: "", output: "", metadata: {} } as any,
    )
    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })
    expect(fake.prompts.length).toBe(0)
  })

  test("ignores non-idle events", async () => {
    const fake = makeFakeClient()
    const hooks = await createCheckRulesPlugin({ check: fakeCheck })({
      client: fake.client,
      directory: "/tmp/proj",
    } as any)
    await hooks.event!({ event: { type: "session.updated", properties: { sessionID: "s1" } } as any })
    expect(fake.prompts.length).toBe(0)
  })

  test("compliant files produce no injection", async () => {
    const fake = makeFakeClient()
    const hooks = await createCheckRulesPlugin({ check: fakeCheck })({
      client: fake.client,
      directory: "/tmp/proj",
    } as any)
    await hooks["tool.execute.after"]!(
      { tool: "edit", sessionID: "s1", callID: "c1", args: { filePath: "good.go" } } as any,
      { title: "", output: "", metadata: {} } as any,
    )
    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })
    expect(fake.prompts.length).toBe(0)
  })

  test("full pipeline: violation -> idle -> injected message (noReply), dedup, drain", async () => {
    const fake = makeFakeClient()
    const hooks = await createCheckRulesPlugin({ check: fakeCheck })({
      client: fake.client,
      directory: "/work/proj",
    } as any)

    // edit the same bad file twice -> dedup -> one check at idle
    await hooks["tool.execute.after"]!(
      { tool: "edit", sessionID: "s1", callID: "c1", args: { filePath: "bad.go" } } as any,
      { title: "", output: "", metadata: {} } as any,
    )
    await hooks["tool.execute.after"]!(
      { tool: "write", sessionID: "s1", callID: "c2", args: { filePath: "bad.go" } } as any,
      { title: "", output: "", metadata: {} } as any,
    )
    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })

    expect(fake.prompts.length).toBe(1)
    const body = fake.prompts[0].body
    expect(body.noReply).toBe(true)
    expect(body.parts[0].text).toContain("check-rules")
    expect(body.parts[0].text).toContain("bad.go")
    expect(fake.prompts[0].path.id).toBe("s1")

    // set was drained: a second idle does not re-inject
    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })
    expect(fake.prompts.length).toBe(1)
  })

  test("autoEnabled=false disables tracking and checking", async () => {
    const fake = makeFakeClient()
    const hooks = await createCheckRulesPlugin({ check: fakeCheck, autoEnabled: false })({
      client: fake.client,
      directory: "/work/proj",
    } as any)
    await hooks["tool.execute.after"]!(
      { tool: "edit", sessionID: "s1", callID: "c1", args: { filePath: "bad.go" } } as any,
      { title: "", output: "", metadata: {} } as any,
    )
    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "s1" } } as any })
    expect(fake.prompts.length).toBe(0)
  })
})
