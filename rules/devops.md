---
domain: devops
tags: [docker, ci, deploy, ecs, health, iac, production, ssh]
priority: normal
---

## 规则:标准部署流程 = Git + ECS + self-hosted runner

**场景**:个人项目部署到自有云服务器(青云香港 / 腾讯云成都等 ECS)。

**做**:统一走 GitOps 流程,新项目直接套用这套标准:
1. 项目根目录提供 `docker-compose.yml`
2. `.github/workflows/deploy.yml`:`on: push` 主分支触发,`runs-on: [self-hosted, <机器label>]`(qingyun / tencent)
3. workflow 步骤固定:checkout → 从 GitHub secrets 生成 `.env` → `docker compose build` → `docker compose up -d --force-recreate` → health check
4. 配好 GitHub secrets(所有密钥走 secrets,`.env` 每次现场生成)
5. 后端服务暴露 `/health` 端点
6. 公网服务通过 Cloudflare Tunnel 暴露,不直接开公网端口

**禁**:手动 SSH 进服务器 `git pull` + 重启;密钥写进 repo;绕过 CI 直接在生产机改部署。

**原因**:可重复、可追溯。每次部署都是一次 git 提交触发的、可审计、可回滚的操作。

## 规则:生产服务器变更只走 IaC + CI,禁止命令式操作

**场景**:任何对生产服务器状态的变更(部署、配置、资源管理)。

**做**:声明式变更——改 `docker-compose.yml` / workflow / 配置文件 → commit → push → CI 应用。变更必须留在 git 里。

**禁**:SSH 进生产机执行命令式变更(`docker rm`、`docker compose down -v`、`rm -rf`、`DROP`、`systemctl stop/disable`、手动改配置)。这类操作不可追溯、不可重复、易误删。

**原因**:可重复、可追溯、Infra-as-code。命令式操作绕过了 git 审计,一次误操作(如删错卷)可能丢失生产数据且无法回溯。

**例**:要停掉一个容器,不是 `ssh prod "docker rm -f x"`,而是从 compose 移除该服务 → commit → CI 重新 `up -d`。

## 规则:AI 操作生产服务器的边界

**场景**:AI(coding agent)需要对生产服务器执行操作时。

**做**:只允许**只读诊断**——`docker ps`、`docker logs`、`docker compose ps`、`df -h`、`systemctl status`、`pg_isready`、`curl` 健康检查等不改变状态的命令。

**禁**:AI 执行任何命令式变更(删除/停止/重建容器、删卷、改配置、DROP 表、kill 进程)。命令式变更必须由人通过 IaC+CI 流程执行。

**原因**:AI 对规则的遵从不是 100% 可靠的,生产变更的误操作代价极高(数据丢失不可逆)。只读诊断无副作用,命令式变更必须有 git 审计兜底。

## 规则:health 端点 = 端口存活即可

**场景**:后端服务的健康检查。

**做**:提供 `/health` 端点,返回 200 即可;CI 的 health check 用 `curl` 确认端口存活,或用 `pg_isready` 等服务原生探针。

**禁**:不提供任何健康检查。

**原因**:CI 部署后需要确认服务起来了。git sha / version 比对是可选增强,不作强制要求。

## 规则:现有手动配置逐步收敛进 IaC

**场景**:服务器上仍有手动配置的状态(systemd 服务如 cloudflared/mihomo/runner、手动建库建用户、手动 docker 操作)。

**做**:新配置一律 IaC 化(写进 repo 的 compose / 脚本 / workflow);存量手动配置在触及时逐步收敛进对应的 infra repo。

**禁**:新增手动配置且不记录到任何 repo;让服务器状态长期漂移(drift)在 git 之外。

**原因**:服务器的真实状态应当能从 git 完整重建。漂移的手动配置一旦机器损坏就无法复现。
