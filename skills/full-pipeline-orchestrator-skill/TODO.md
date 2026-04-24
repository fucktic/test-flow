# 项目待优化列表
## 待优化项
1. **imgbb上传缓存优化**：当前视频阶段每次处理分镜都重新上传所有参考图到imgbb，即使短链在1小时有效期内也会重复上传，浪费带宽和API额度。优化方案：增加短链缓存机制，记录资源的上传时间和公网URL，有效期内直接复用。
2. **批量回写优化**：当前每个微小操作都实时回写flow.json并触发全量校验，长剧集（如30个分镜）会产生大量IO和重复校验，性能低下。优化方案：增加可配置的批量回写开关，非关键步骤支持合并回写，每批次仅触发1次全量校验。
3. **API自动重试机制**：当前所有API调用失败后直接返回，无重试机制，网络波动等偶发问题需要用户手动重试。优化方案：增加可配置的自动重试次数，仅对网络错误、限流等非业务错误自动重试。
## 已完成修改
### v1.1.0 2024-XX-XX
1. 统一UUID格式规范：全局统一使用36位带横线的标准UUIDv4格式，修正了flow_example_annotated.md中32位UUID的错误描述，确认校验脚本规则正确。
2. 明确sceneId语义：修正了flow_example_annotated.md和FLOW_CONTRACT.md中sceneId对应scenes[].id的错误描述，明确sceneId对应scenes[].name的展示名（如S-1）。
3. 修正分镜prompt写入规则：修改了storyboard-authoring-skill/SKILL.md中的错误描述，要求分镜阶段必须将首帧生成提示词写入sceneImageNode.data.prompt，将视频生成提示词写入sceneVideoNode.data.prompt，对齐主SKILL白名单规则。
4. 新增manifest校验机制：新增validate_manifest.sh脚本，支持校验manifest结构合法性、引用UUID有效性、URL合法性，集成到视频阶段前置校验流程中，更新了主SKILL.md和video-generator-skill/SKILL.md的相关描述。
