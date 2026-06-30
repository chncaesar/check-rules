---
domain: devops
tags: [docker, k8s, health, ci, deploy]
priority: normal
---

## 规则:所有后端服务必须有 /health 端点

**场景**:对外提供 HTTP 服务的后端。

**做**:`/health` 端点返回 `{"status":"ok","version":"<git sha>","timestamp":"<ISO8601>"}`。

**禁**:没有健康检查端点。

**原因**:deployer 靠此判断部署就绪。
