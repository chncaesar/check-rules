---
domain: devops
tags: [docker, k8s, health, ci, deploy]
priority: normal
---

## 规则:生产环境禁止 docker compose 跑数据库

**场景**:生产环境的数据库部署。

**做**:数据库用独立实例(云服务或独立 PostgreSQL 实例); docker compose 仅用本地/测试环境。

**禁**:生产环境把 PostgreSQL 塞在 docker-compose.yml 里。

**原因**:备份风险、资源隔离、运维安全。

## 规则:所有后端服务必须有 /health 端点

**场景**:对外提供 HTTP 服务的后端。

**做**:`/health` 端点返回 `{"status":"ok","version":"<git sha>","timestamp":"<ISO8601>"}`。

**禁**:没有健康检查端点。

**原因**:deployer 靠此判断部署就绪。
