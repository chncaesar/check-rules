---
domain: ios-swift
tags: [swiftui, viewmodel, mvvm]
priority: normal
---

## 规则：SwiftUI View 内禁止写业务逻辑，移到 ViewModel

**场景**：SwiftUI 视图需要做网络请求、数据处理、状态计算等业务逻辑。

**做**：业务逻辑放 ViewModel（ObservableObject）；View 只绑定状态、触发 ViewModel 方法、渲染 UI。

**禁**：在 View 的 body 或按钮闭包里直接写 URLSession 网络请求、数据解析、业务计算。

**原因**：View 里写业务逻辑无法单元测试，且 View 重建时逻辑会被反复触发。

**例**：登录页点击登录，调 `viewModel.login()`，网络请求在 ViewModel 里；不是在按钮 action 里直接 `URLSession.shared.dataTask`。

## 规则：用户错误信息必须是干净的中文文案

**场景**：向用户展示错误（Alert/Toast）。

**做**：用固定中文模板（什么失败 + 为什么 + 怎么办）。

**禁**：把异常 `error.localizedDescription`、堆栈、内部字段名直接弹给用户。

**原因**：异常细节对用户无意义且暴露内部实现。
