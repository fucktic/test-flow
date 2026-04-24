---
name: general-review-skill
description: >-
  INTERNAL_PIPELINE_PLUGIN_ONLY. 通用审核插件，支持所有类型的自动审核，公共规则见根目录FLOW_CONTRACT.md。
---

# 通用审核插件
本插件为全流程唯一自动审核入口，支持所有审核场景，审核规则完全配置化。

## 入参说明
| 参数 | 说明 | 可选值 |
|------|------|--------|
| review_type | 审核类型 | character/scene/storyboard/script/image/compliance |
| project_id | 项目ID | 有效项目UUID |

## 核心逻辑
1. 根据review_type加载对应规则模板
2. 按规则模板读取指定审核对象文件
3. 逐项校验内容
4. 输出统一格式结果：
   - PASS：所有校验项通过
   - FAIL：包含问题位置、触碰规则、修改建议

## 规则模板格式
所有规则存放在`rules/`目录下，YAML格式：
```yaml
# 审核对象配置
target_files:
  - 路径1
  - 路径2
# 校验项配置
check_items:
  - name: 校验项名称
    rule: 校验规则描述
    weight: 权重（0-10）
    pass_condition: 通过条件
# 验收标准
acceptance:
  min_score: 最低通过分
  no_item_below: 单项最低分
```

## 输出规范
- PASS：平均分>=最低通过分且无单项低于单项最低分
- FAIL：返回所有不通过项的详细信息
- 阶段标记与流转规则完全遵守主SKILL.md约定
