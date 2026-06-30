---
domain: backend-go
tags: [orm, sql, error]
priority: normal
---

## 规则：高 TPS Go 服务禁用 ORM，用裸 SQL

**场景**：Go 后端服务访问数据库，尤其有性能要求（高 TPS）的服务。

**做**：用裸 SQL（database/sql 或 sqlx），手写 SQL 语句。

**禁**：引入 ORM（如 gorm、ent）；用 ORM 自动生成 SQL。

**原因**：ORM 生成的 SQL 不可预测，难优化 join、难控执行计划。

**例**：查订单用手写 `SELECT ... FROM orders WHERE ...` + sqlx，不是 `db.Where(...).Find(&orders)`。

## 规则：错误必须 wrap，带上下文

**场景**：Go 代码中处理 error。

**做**：用 `fmt.Errorf("...: %w", err)` 包装错误，保留调用链上下文。

**禁**：直接 `return err` 丢失上下文；吞掉错误。

**原因**：裸 error 难定位问题来源。
