module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新功能（feature）
        "fix", // 修补bug
        "docs", // 文档（documentation）
        "style", // 格式（不影响代码运行的变动）
        "refactor", // 重构（即不是新增功能，也不是修改bug的代码变动）
        "perf", // 优化相关，比如提升性能、体验
        "test", // 增加测试
        "build", // 编译相关的修改，例如发布版本、对项目构建或者依赖的改动
        "ci", // 持续集成修改
        "chore", // 构建过程或辅助工具的变动
        "revert", // 回滚到上一个版本
      ],
    ],
    "type-case": [0],
    "type-empty": [2, "never"],
    "scope-empty": [0],
    "scope-case": [0],
    "subject-full-stop": [0, "never"],
    "subject-case": [0, "never"],
    "header-max-length": [0, "always", 72],
  },
};
