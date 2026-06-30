---
domain: llm-app
tags: [streaming, sse, websocket]
priority: normal
---

## 规则:LLM 应用必须全链路 streaming,禁止缓冲全量响应

**场景**:任何调用 LLM 生成文本并返回给用户的应用。

**做**:前端用 SSE 或 WebSocket 接收流式响应;后端调 LLM 用 streaming 方法,逐 token 转发。

**禁**:后端调 LLM 缓冲完整 response 再发给前端;前端等待完整数据才渲染。

**原因**:大幅降低感知延迟;实时反馈防止超时;用户体验关键。

## 规则:LLM streaming 要处理中断和重连

**场景**:流式响应的长连接。

**做**:前端处理 SSE 断开重连;后端设置合理超时并优雅关闭。

**禁**:断连后不重试;不设超时永久挂连接。
