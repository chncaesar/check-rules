---
domain: backend-go
tags: [orm, sql, error]
priority: normal
---

## 规则：错误必须 wrap，带上下文

**场景**：Go 代码中处理 error。

**做**：用 `fmt.Errorf("...: %w", err)` 包装错误，保留调用链上下文。

**禁**：直接 `return err` 丢失上下文；吞掉错误。

**原因**：裸 error 难定位问题来源。
