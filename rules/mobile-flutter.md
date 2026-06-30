---
domain: mobile-flutter
tags: [money, drift, riverpod]
priority: normal
---

## 规则：金额一律用 int（分），禁用 double

**场景**：Flutter 应用中涉及金额的输入、存储、计算、显示。

**做**：金额用 int 存「分」；输入转换用 `CurrencyUtils.textToCents()`，显示用 `centsToText()`。

**禁**：用 double 存金额；用 `double.tryParse` 解析金额输入。

**原因**：浮点精度误差导致金额对账对不平。

**例**：记账输入「9.9」元，存成 int 990；不是 `double.tryParse('9.9')`。

## 规则：Drift 写库 + Navigator.pop 前，必须先 invalidate

**场景**：Drift 写操作（transaction/DAO）后紧接着 Navigator.pop 返回。

**做**：pop 之前先 `ref.invalidate` 相关 Riverpod provider。

**禁**：`execute()` 一返回就直接 pop。

**原因**：execute 返回不代表 watch stream 已 emit，上一页会看到旧数据。
