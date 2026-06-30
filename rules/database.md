---
domain: database
tags: [money, migration, comment]
priority: normal
---

## 规则:金额一律用 int（分），禁用 double/浮点

**场景**：任何涉及金额的存储、计算、输入输出转换。

**做**：金额用 int 存「分」；输入「9.9 元」转成整数 990 再存。

**禁**：用 double/float 存金额；用 `double.tryParse` 解析金额。

**原因**：浮点有精度误差，金额累加对账会对不平。

**例**：9.9 元存成整数 990，不是 double 9.9。

## 规则：表结构迁移禁止 drop + recreate，必须保留数据

**场景**：修改已存在的表结构（加字段、改字段）。

**做**：用 ALTER TABLE（加列、改列、RENAME）+ 必要时 UPDATE 回填，保留已有数据。

**禁**：drop table 再 create table；delete + 重建。

**原因**：drop 会丢光用户已有数据。问一句：如果用户有 100 行数据，迁移后还剩几行？

**例**：给表加 status 字段，用 `ALTER TABLE x ADD COLUMN status ...`，不是删表重建。

## 规则：每张表和每个字段必须有 COMMENT

**场景**：建表或加字段的迁移。

**做**：用数据库原生 COMMENT（如 PostgreSQL `COMMENT ON TABLE/COLUMN`）记录业务含义。

**禁**：用 `--` 行内注释代替（不会持久化到 schema）；不写注释。

**原因**：表/列的业务含义必须随 schema 持久化，方便后续维护。
