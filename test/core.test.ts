import { describe, expect, test } from "bun:test"
import { isCodeFile, detectDomains } from "../src/core.js"

describe("isCodeFile", () => {
  test("recognizes mapped code extensions", () => {
    expect(isCodeFile("/a/b/main.go")).toBe(true)
    expect(isCodeFile("service.py")).toBe(true)
    expect(isCodeFile("View.swift")).toBe(true)
    expect(isCodeFile("schema.sql")).toBe(true)
    expect(isCodeFile("deploy.yaml")).toBe(true)
  })

  test("rejects non-code files", () => {
    expect(isCodeFile("README.md")).toBe(false)
    expect(isCodeFile("notes.txt")).toBe(false)
    expect(isCodeFile("data.csv")).toBe(false)
    expect(isCodeFile("/tmp/DESIGN.md")).toBe(false)
  })

  test("recognizes special-named files without mapped extensions", () => {
    expect(isCodeFile("Dockerfile")).toBe(true)
    expect(isCodeFile("docker-compose.yml")).toBe(true)
    expect(isCodeFile("001_add_users_migration.rb")).toBe(true)
  })
})

describe("detectDomains", () => {
  test("maps extension to domain", () => {
    expect(detectDomains("main.go")).toContain("backend-go")
    expect(detectDomains("app.dart")).toContain("mobile-flutter")
    expect(detectDomains("v.swift")).toContain("ios-swift")
  })

  test("adds database domain for migration files", () => {
    expect(detectDomains("003_migrate_accounts.go")).toContain("database")
    expect(detectDomains("003_migrate_accounts.go")).toContain("backend-go")
  })

  test("adds llm-app domain for llm/stream files", () => {
    expect(detectDomains("llm_client.py")).toContain("llm-app")
    expect(detectDomains("stream_handler.py")).toContain("llm-app")
  })

  test("adds devops for docker files", () => {
    expect(detectDomains("Dockerfile")).toContain("devops")
    expect(detectDomains("docker-compose.yml")).toContain("devops")
  })

  test("returns unknown for unmapped files", () => {
    expect(detectDomains("README.md")).toEqual(["unknown"])
  })
})
