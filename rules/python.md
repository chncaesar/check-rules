---
domain: python
tags: [logging, style, dry, imports, exceptions, testing]
priority: normal
---

## 规则:日志用 logging 模块,禁用 print

**场景**:Python 代码中输出运行信息、调试信息、状态。

**做**:用 `logging.getLogger(__name__)`, logger.info/warning/error/exception; 日志格式用 `%`-style(`logger.info("x=%s", val)`),不用 f-string。

**禁**:用 `print()` 做运行日志;用 f-string 写日志消息。

**原因**:print 不可控输出、无级别;f-string 即使日志级别关闭也先执行格式化,浪费。

## 规则:DRY — 先搜索现有实现,禁止重复造轮子

**场景**:写新功能前。

**做**:先浏览项目搜索同名函数/类/工具模块;复用已有 base class、mixin、decorator。

**禁**:不搜索就直接写新函数;复制粘贴相似逻辑。

## 规则:Python 代码风格

**场景**:所有 Python 代码。

**做**:`snake_case` 变量/函数, `CamelCase` 类, `UPPER_SNAKE_CASE` 常量; 4 空格缩进; import 分组(stdlib→第三方→本地)。

**禁**:tab 缩进;混用命名风格。

## 规则:异常不吞,捕获要窄

**场景**:Python 代码中的异常处理。

**做**:捕获具体异常类型;keep `try` 块窄;在顶层边界用自定义业务异常。

**禁**:`except Exception` 裸捕(除非真顶层);吞异常不处理。

## 规则:写 bug 修 bug 必须有测试

**场景**:加新功能或修 bug。

**做**:单元测试覆盖正常路径 + 关键边界;修 bug 时先补一个能复现的测试。

**禁**:无测试就声称修完。
