import type { AgentStreamKind } from "./resolve-agent-command";

const BT = "\x60"; // `

// Strip ANSI escape codes from terminal output (aligned with message-content)
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[mGKHFABCDJM]/g, "").replace(/\x1B\][^\x07]*\x07/g, "");
}

/** 去掉 execute API 注入的「系统启动」横幅（各语言 [系统]/[System] + 🚀） */
export function stripAgentStreamBanner(text: string): string {
  return text.replace(/^\[[^\]]+]\s*🚀[^\n]*\n+/, "");
}

/** 流式回显「过程与工具」区预览：剥 ANSI、横幅，统一换行 */
export function normalizeAgentStreamPreview(raw: string): string {
  return stripAnsi(stripAgentStreamBanner(raw)).replace(/\r\n/g, "\n");
}

// `</redacted_thinking>` … `</think>` 成对出现（扩展思考）
const REDACTED_OPEN = `${BT}<redacted_thinking>${BT}`;
const REDACTED_CLOSE = `${BT}</redacted_thinking>${BT}`;
const REDACTED_THINKING_BLOCK = new RegExp(
  `${REDACTED_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s\\S]*?)${REDACTED_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
  "gi",
);

/** 强终端/工具信号：不因「像一句话」而当作对话 */
function hasStrongToolLineSignal(trimmed: string): boolean {
  if (/^\$\s|^#\s/.test(trimmed)) return true;
  if (/^Session:\s*|^Duration:\s*|^Messages:\s*|^Tokens?:\s*|^Model:\s*/i.test(trimmed))
    return true;
  if (/^[│┃|]\s|^[dl-][rwx-]{9}\+?@?\s+\d+\s|^total\s+\d+\s*$/i.test(trimmed)) return true;
  if (/^\s*[→➜]\s*Read\s+/i.test(trimmed)) return true;
  if (/^Read\s+(?:skills\/|projects\/)/i.test(trimmed)) return true;
  if (/^curl\s|^wget\s|^git\s|^npm\s|^pnpm\s|^npx\s/i.test(trimmed)) return true;
  if (/^Starting inspector|^Debugger attached/i.test(trimmed)) return true;
  if (/waiting for the debugger to (dis)?connect/i.test(trimmed)) return true;
  if (/^>\s*build\s*·/i.test(trimmed)) return true;
  return false;
}

/**
 * 完整的中文/英文对话句，不应进「过程与工具」（除非同时有强工具信号）。
 */
function isLikelyConversationalProseLine(trimmed: string): boolean {
  if (hasStrongToolLineSignal(trimmed)) return false;
  if (trimmed.length < 14) return false;
  if (/[\u4e00-\u9fff]{10,}/.test(trimmed)) {
    if (/[。！？]\s*$/.test(trimmed)) return true;
    if (trimmed.length >= 24 && /[，。；：、]/.test(trimmed)) return true;
  }
  if (
    trimmed.length >= 32 &&
    /^[A-Za-z]/.test(trimmed) &&
    /[.!?]\s*$/.test(trimmed) &&
    /\s/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

/**
 * Hermes / OpenCode 等智能体「完成后」常见结论文排版（须留在主气泡 final，勿当工具行）。
 * 与 isLikelyConversationalProseLine 互补：短标题、列表行往往不满足「对话句」长度/句读条件。
 */
function isStructuredAssistantFinalLine(trimmed: string): boolean {
  // Markdown 标题
  if (/^#{1,6}\s+\S/.test(trimmed)) return true;

  // 无序列表（须「符号 + 空格 + 正文」，避免误伤 ls 权限位 -rw-r--r--）
  if (/^\s*[-*+]\s+\S/.test(trimmed)) {
    if (/[\u4e00-\u9fff]/.test(trimmed)) return true;
    if (trimmed.length >= 28) return true;
  }

  // 有序列表 1. 2. …（结论文，非版本号）
  if (/^\s*\d{1,2}\.\s+\S/.test(trimmed)) {
    if (/[\u4e00-\u9fff]/.test(trimmed)) return true;
    if (trimmed.length >= 24) return true;
  }

  // 小节标题「……：」以中文为主（排除明显工具指令式标题）
  if (/[：:]\s*$/.test(trimmed) && /[\u4e00-\u9fff]{3,}/.test(trimmed) && trimmed.length <= 96) {
    if (
      /^(读取文件|列出目录|查询列表|准备读取|准备列出|写入文件|修改文件|删除文件|查看文件|打开文件)/u.test(
        trimmed,
      )
    ) {
      return false;
    }
    return true;
  }

  // Claude 等用 ● 表工具；若本行以项目符号开头且含中文长说明，视为结论文而非工具行
  if (/^[●►]\s+/.test(trimmed) && /[\u4e00-\u9fff]/.test(trimmed) && trimmed.length >= 12)
    return true;

  return false;
}

/**
 * Hermes 等用 Unicode 框线「│ / ┃ + 空格」作面板左边；原先把其当成 npm tree 的 │ 树线，导致整段结论文被吃进「过程」。
 * 真树线多为 │ 后直接 ├ └ ─ 等；结论文则为 │ 后接中文、列表或【】标题。
 */
function isDecorativePanelVerticalBarLine(trimmed: string): boolean {
  const m = trimmed.match(/^[│┃]\s+(.*)$/);
  if (!m) return false;
  const body = (m[1] ?? "").trimStart();
  if (!body) return false;
  // 包/目录树：│ 后继续画框，且无中文正文
  if (/^[├└┌┬┴┐┘─╴╵╶╷]/.test(body)) return false;
  if (/^[│┃]\s/.test(body)) return false;
  if (/^[\s─═┆┄]*[├└]/.test(body) && !/[\u4e00-\u9fff]{3,}/.test(body)) return false;

  if (/[\u4e00-\u9fff]{4,}/.test(body)) return true;
  if (/^(你好|我查看|以下是|你可以|备注|【)/u.test(body)) return true;
  if (/^\d{1,2}\.\s/.test(body) && /[\u4e00-\u9fff]/.test(body)) return true;
  if (/^[-*]\s/.test(body) && /[\u4e00-\u9fff]/.test(trimmed)) return true;
  return false;
}

/**
 * 凡涉及「操作 / 工具 / 命令 / 中间结果」的行均归入「过程与工具」。
 * 注意：必须用「对话句」排除，避免把正常交互说明误判为过程。
 */
function isOperationOrToolLine(trimmed: string): boolean {
  if (!trimmed) return false;
  // Node --inspect：易与英文「对话句」混淆，须优先归为过程
  if (/waiting for the debugger to (dis)?connect/i.test(trimmed)) return true;
  if (isLikelyConversationalProseLine(trimmed)) return false;
  if (isStructuredAssistantFinalLine(trimmed)) return false;
  if (isDecorativePanelVerticalBarLine(trimmed)) return false;

  // —— 读文件、列目录、查列表（仅行首或明确工具句式，不用全文子串匹配） ——
  if (/^read_file\b|^read_file:|^read_file\s/i.test(trimmed)) return true;
  if (/^read\s+[/"'`~]|^read\s+\/|^read\s+~|^read\s+[A-Za-z]:\\/.test(trimmed)) return true;
  if (/^(reading|read)\s+(file|path|files?|content)\b/i.test(trimmed)) return true;
  if (/^preparing\s+read/i.test(trimmed)) return true;
  if (/^(ls|dir|tree)\b/i.test(trimmed)) return true;
  if (/^list(ing)?\s+(files?|dirs?|directories|folder|path)/i.test(trimmed)) return true;
  if (/^(glob|rglob)\b/i.test(trimmed)) return true;
  if (/^(读取文件|读取路径|查看文件|打开文件|读文件)\s*[:：]?\s*/u.test(trimmed)) return true;
  if (/^列出\s*(目录|文件|文件夹|路径)/u.test(trimmed)) return true;
  if (/^查询\s*(文件|目录)\s*(列表|清单)/u.test(trimmed)) return true;
  if (/^准备\s*(读取文件|列出目录|查询列表)/u.test(trimmed)) return true;

  // —— ls -l / ls -la 等「命令本身已进过程」后的纯输出（无 $ 前缀） ——
  if (/^total\s+\d+\s*$/.test(trimmed)) return true;
  // drwxr-xr-x@  4 user  group …（macOS 扩展属性 @ / ACL +）
  if (/^[dl-][rwx-]{9}\+?@?\s+\d+\s/.test(trimmed)) return true;

  // —— OpenCode 等：→ Read path / Read skills/… ——
  if (/^\s*[→➜]\s*Read\s+/i.test(trimmed)) return true;
  if (/^Read\s+(?:skills\/|projects\/|\.?\/|~\/|[A-Za-z]:\\)/i.test(trimmed)) return true;

  // —— 写/改/删/建文件与补丁类工具 ——
  if (
    /^(write_file|edit_file|delete_file|apply_patch|search_replace|str_replace|patch|move_file|copy_file)\b/i.test(
      trimmed,
    )
  )
    return true;
  if (/^(touch|mkdir|rm\b|rmdir|mv|cp|ln|chmod|chown)\b/i.test(trimmed)) return true;
  if (/^write\s+[/'"`~/]|^write\s+\//.test(trimmed)) return true;
  if (/^(写入文件|修改文件|删除文件|保存到|追加到|覆盖文件)/u.test(trimmed)) return true;
  if (/^(已写入|已修改|已删除|已保存|正在写入|正在修改|正在删除)/u.test(trimmed)) return true;

  // —— Shell / 包管理 / 构建 / 容器 / 语言运行时 ——
  if (/^Starting inspector|^Debugger attached|^address already in use$/i.test(trimmed)) return true;
  if (/^inspector on\s+\d+\.\d+\.\d+\.\d+/i.test(trimmed)) return true;
  if (/^\$\s|^#\s/.test(trimmed)) return true;
  if (/^uuidgen\b/i.test(trimmed)) return true;
  if (/^curl\s|^wget\s|^httpie\s|^fetch\s/i.test(trimmed)) return true;
  if (/^Initializing agent\b/i.test(trimmed)) return true;
  if (/^preparing\s+/i.test(trimmed)) return true;
  if (/^read\s+[/"']?[A-Za-z/~.]/.test(trimmed)) return true;
  if (/^ls\s+/.test(trimmed)) return true;
  if (
    /^cat\s+|^head\s+|^tail\s+|^grep\s+|^find\s+|^sed\s+|^awk\s+|^xargs\s+|^sort\s+|^uniq\s+/i.test(
      trimmed,
    )
  )
    return true;
  if (/^npm\s|^pnpm\s|^yarn\s|^git\s|^npx\s|^bun\s/i.test(trimmed)) return true;
  if (/^(docker|kubectl|helm|terraform|make|cmake|ninja|gradle|mvn)\b/i.test(trimmed)) return true;
  if (/^(python|python3|node|deno|bun|ruby|perl|php)\b/i.test(trimmed)) return true;
  if (/^(go\s+(run|build|test|mod|get|install)|cargo|rustc|javac|java)\b/i.test(trimmed))
    return true;
  if (/^(pip|pip3|poetry|conda|uv)\s/i.test(trimmed)) return true;

  // —— 工具调用 / 执行类英文 ——
  if (
    /^(invoke|invoking|call|calling|run|running|execute|executing)\s+(tool|command|shell|task|script)/i.test(
      trimmed,
    )
  )
    return true;
  if (/^(Editing|Bash|Shell|Command|Tool)\b/i.test(trimmed)) return true;

  // —— UI 步骤、树线、项目符号（Hermes 面板 │ 正文见 isDecorativePanelVerticalBarLine） ——
  if (/^[│┃]\s/.test(trimmed)) return true;
  if (/^\|\s*build\s*·/i.test(trimmed) || /^\|\s+[├└│─]/.test(trimmed)) return true;
  if (/^[●▌►◆◇✓✔✗✘]\s?/.test(trimmed)) return true;
  if (/^Step\s+\d+|^步骤\s*\d+/i.test(trimmed)) return true;
  if (/^\s*at\s+[\w./(]+\s/.test(trimmed)) return true;
  if (/^➜\s|^→\s|^->\s/.test(trimmed) && !/^→\s*Read\s+/i.test(trimmed)) return true;

  // —— URL / JSON 片段 / API 行 ——
  if (/^https?:\/\//.test(trimmed)) return true;
  if (/^\s*"[^"]+"\s*:/.test(trimmed)) return true;
  if (/^\s*[[{]\s*$/.test(trimmed)) return true;
  if (trimmed === "}" || trimmed === "]" || trimmed === "}," || trimmed === "],") return true;
  if (/^"status"\s*:|^"content"\s*:|^"usage"\s*:|^"error"\s*:|^"tool"\s*:/i.test(trimmed))
    return true;

  // —— 行尾耗时（带步骤语义） ——
  if (
    /\d+\.\d+s\s*$/.test(trimmed) &&
    /[$/]|read\s|ls\s|preparing|terminal|read_file|write|edit|delete|npm|git|curl|\$\s/u.test(
      trimmed,
    )
  )
    return true;

  // —— 源码位置样式 file.ts:12: ——
  if (/\.\w{1,8}:\d+(:\d+)?\b/.test(trimmed) && /[/\\]/.test(trimmed)) return true;

  return false;
}

/** 粗略统计一行中大括号净深度（用于吞掉 curl 后的多行 JSON） */
function braceDelta(line: string): number {
  let d = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\" && inStr) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (!inStr) {
      if (c === "{") d++;
      else if (c === "}") d--;
    }
  }
  return d;
}

/** 首个「明显是日志/工具」的行，用于跳过智能体回显在前的用户提示长文 */
function findFirstProcessLineIndex(lines: string[]): number {
  for (let j = 0; j < lines.length; j++) {
    const tr = lines[j].trim();
    if (!tr) continue;
    if (/Initializing agent/i.test(tr)) return j;
    if (
      /Debugger attached|Starting inspector|inspector on|address already in use|waiting for the debugger to (dis)?connect/i.test(
        tr,
      )
    )
      return j;
    if (/^preparing\s+(terminal|read_file)/i.test(tr)) return j;
    if (isOperationOrToolLine(tr)) return j;
    if (tr.startsWith("{")) return j;
  }
  return 0;
}

/**
 * 从文本开头提取「过程」块：含多行 JSON、连续日志、空行（块内）。
 * 若开头是自然语言（如重复的用户指令），从首个 unmistakable 日志行再开始收过程。
 */
function extractLeadingProcessBlock(text: string): { prefix: string; rest: string } {
  const lines = text.split("\n");
  const startAt = findFirstProcessLineIndex(lines);
  let preamble = "";
  let workLines = lines;
  if (startAt > 0) {
    preamble = lines.slice(0, startAt).join("\n").trimEnd();
    workLines = lines.slice(startAt);
  }

  let i = 0;
  const buf: string[] = [];

  const skipLeadingBlanks = () => {
    while (i < workLines.length && !workLines[i].trim()) i++;
  };
  skipLeadingBlanks();

  while (i < workLines.length) {
    const line = workLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (buf.length > 0) {
        buf.push(line);
        i++;
        continue;
      }
      i++;
      continue;
    }

    // 多行 JSON：以 { 开头，按大括号净深度吞到闭合（braceDelta 尽量忽略字符串内括号）
    if (trimmed.startsWith("{")) {
      let depth = 0;
      const startLine = i;
      while (i < workLines.length) {
        const L = workLines[i];
        buf.push(L);
        depth += braceDelta(L);
        i++;
        if (depth <= 0) break;
        if (i - startLine > 4000) break;
      }
      continue;
    }

    if (isOperationOrToolLine(trimmed)) {
      buf.push(line);
      i++;
      continue;
    }

    // 可能是 JSON 中间行（无前导 {，但仍在对象里）——若上一行是过程且本行像 JSON 续行
    if (
      buf.length > 0 &&
      (/^\s*[,}\]]/.test(trimmed) || /^\s*".*":\s/.test(trimmed) || /^[}\]],?\s*$/.test(trimmed))
    ) {
      buf.push(line);
      i++;
      continue;
    }

    break;
  }

  if (buf.length === 0) {
    if (preamble) return { prefix: preamble, rest: workLines.join("\n") };
    return { prefix: "", rest: text };
  }

  const block = buf.join("\n").trimEnd();
  const prefix = [preamble, block].filter(Boolean).join("\n\n").trimEnd();
  const rest = workLines.slice(i).join("\n");
  return { prefix, rest };
}

/**
 * 若全文几乎都是日志、仅末尾有一小段自然语言，把末尾提为 final（OpenCode/Hermes 常见）。
 * Hermes 完成后的结构化说明（标题/列表/「小节：」）由 isStructuredAssistantFinalLine 保留在 final。
 */
function promoteTrailingSummaryIfNeeded(
  processJoined: string,
  finalText: string,
): {
  process: string;
  final: string;
} {
  const tail = finalText.trim();
  if (!tail) return { process: processJoined, final: finalText };

  const parts = tail.split(/\n\n+/);
  if (parts.length < 2) return { process: processJoined, final: finalText };

  const last = parts[parts.length - 1]?.trim() ?? "";
  const restParas = parts.slice(0, -1).join("\n\n").trim();

  if (!last || last.length < 8) return { process: processJoined, final: finalText };

  const firstLine = last.split("\n")[0].trim();
  const lastLooksProse =
    last.length >= 12 &&
    !/^\$\s/.test(firstLine) &&
    !firstLine.startsWith("{") &&
    !isOperationOrToolLine(firstLine);

  const restLooksLoggy =
    restParas.length > 40 &&
    /(\$\s|curl\s|^Read\s+(skills|projects)|^\s*[→➜]\s*Read|read_file|Debugger attached|^preparing\s+terminal)/im.test(
      restParas,
    );

  if (lastLooksProse && restLooksLoggy && restParas.length > 24) {
    const newProcess = [processJoined, restParas].filter(Boolean).join("\n\n").trim();
    return { process: newProcess, final: last };
  }

  return { process: processJoined, final: finalText };
}

/** Hermes / OpenCode 等输出末尾的会话统计（应从主气泡移入「过程与工具」） */
function isSessionMetricsFooterLine(trimmed: string): boolean {
  if (/^Session:\s*/i.test(trimmed)) return true;
  if (/^Duration:\s*/i.test(trimmed)) return true;
  if (/^Messages:\s*/i.test(trimmed)) return true;
  if (/^Tokens?:\s*/i.test(trimmed)) return true;
  if (/^Cost:\s*/i.test(trimmed)) return true;
  if (/^Model:\s*/i.test(trimmed)) return true;
  // 单独一行的 session id：20260419_135446_1a399c
  if (/^\d{8}_\d{6}_[a-f0-9]{4,}$/i.test(trimmed)) return true;
  if (/\(\s*\d+\s*user\s*,\s*\d+\s*tool calls?\s*\)/i.test(trimmed)) return true;
  return false;
}

/**
 * 从正文尾部剥离连续「会话/统计」行，归入过程区。
 */
function extractTrailingSessionMetricsFooter(text: string): { final: string; footer: string } {
  const lines = text.split("\n");
  let i = lines.length - 1;
  while (i >= 0 && !lines[i].trim()) i--;
  if (i < 0) return { final: text, footer: "" };

  const collected: string[] = [];
  while (i >= 0) {
    const t = lines[i].trim();
    if (!t) {
      if (collected.length === 0) {
        i--;
        continue;
      }
      break;
    }
    if (isSessionMetricsFooterLine(t)) {
      collected.unshift(lines[i]);
      i--;
      continue;
    }
    break;
  }
  if (collected.length === 0) return { final: text, footer: "" };
  return {
    final: lines
      .slice(0, i + 1)
      .join("\n")
      .trimEnd(),
    footer: collected.join("\n").trim(),
  };
}

/** Node --inspect 结束/连接时在 stderr 常见，应从正文尾部移入过程区 */
function extractTrailingDebuggerDisconnectNoise(text: string): { final: string; trailer: string } {
  const lines = text.split("\n");
  let i = lines.length - 1;
  while (i >= 0 && !lines[i].trim()) i--;
  if (i < 0) return { final: text, trailer: "" };

  const collected: string[] = [];
  while (i >= 0) {
    const t = lines[i].trim();
    if (!t) {
      if (collected.length === 0) {
        i--;
        continue;
      }
      break;
    }
    if (/waiting for the debugger to (dis)?connect/i.test(t)) {
      collected.unshift(lines[i]);
      i--;
      continue;
    }
    break;
  }
  if (collected.length === 0) return { final: text, trailer: "" };
  return {
    final: lines
      .slice(0, i + 1)
      .join("\n")
      .trimEnd(),
    trailer: collected.join("\n").trim(),
  };
}

/**
 * Hermes 用 ╭╰│ 等 Unicode 框线包裹的结论文；主气泡展示时去掉边框，仅保留正文行。
 */
export function stripHermesPanelDecorations(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const u = raw.trim();
    if (u.length === 0) {
      out.push("");
      continue;
    }
    if (u.startsWith("╭") && (u.endsWith("╮") || /Hermes|⚕/i.test(u))) {
      continue;
    }
    if (
      u.startsWith("╰") &&
      (u.endsWith("╯") ||
        /^╰[─━═\s·]+╯?\s*$/.test(u) ||
        (/^╰[─━═·\s]{6,}/.test(u) && !/[\u4e00-\u9fff]/.test(u)))
    ) {
      continue;
    }
    const bar = raw.match(/^(\s*)[│┃]\s*(.*)$/);
    if (bar) {
      out.push((bar[1] ?? "") + (bar[2] ?? ""));
      continue;
    }
    out.push(raw);
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 从「非 Codex」的纯文本流中拆分：可折叠的过程区 + 主展示区最终回复。
 * 与 resolve-agent-command 中的 opencode / claude / openclaw / hermes / generic 配合使用。
 */
export function splitPlainAgentOutput(
  kind: AgentStreamKind,
  raw: string,
): {
  process: string;
  final: string;
} {
  let work = stripAnsi(stripAgentStreamBanner(raw)).replace(/\r\n/g, "\n");

  const collected: string[] = [];

  const takeBlock = (re: RegExp): void => {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = g.exec(work)) !== null) {
      const inner = (m[1] ?? "").trim();
      if (inner) collected.push(inner);
    }
    work = work.replace(re, "");
  };

  takeBlock(/<thinking>([\s\S]*?)<\/thinking>/gi);
  takeBlock(REDACTED_THINKING_BLOCK);

  let processJoined = collected.filter(Boolean).join("\n\n").trim();
  let finalText = work.trim();

  const openThink = "<thinking>";
  const idxThink = finalText.indexOf(openThink);
  if (idxThink >= 0 && !finalText.includes("</thinking>")) {
    const before = finalText.slice(0, idxThink).trim();
    const inside = finalText.slice(idxThink + openThink.length).trim();
    if (inside) {
      processJoined = [processJoined, inside].filter(Boolean).join("\n\n").trim();
      finalText = before;
    }
  }

  const idxRed = finalText.indexOf(REDACTED_OPEN);
  if (idxRed >= 0 && !finalText.includes(REDACTED_CLOSE)) {
    const before = finalText.slice(0, idxRed).trim();
    const inside = finalText.slice(idxRed + REDACTED_OPEN.length).trim();
    if (inside) {
      processJoined = [processJoined, inside].filter(Boolean).join("\n\n").trim();
      finalText = before;
    }
  }

  const useRichProcessSplit =
    kind === "claude" || kind === "opencode" || kind === "hermes" || kind === "openclaw";

  if (useRichProcessSplit) {
    const toolish = extractLeadingProcessBlock(finalText);
    if (toolish.prefix) {
      processJoined = [processJoined, toolish.prefix].filter(Boolean).join("\n\n").trim();
      finalText = toolish.rest.trim();
    }

    // claude 旧逻辑：行首 ● / Running 等（已由 isOperationOrToolLine 覆盖大部分，保留一层兜底）
    if (kind === "claude") {
      const legacy = extractClaudeOnlyPrefix(finalText);
      if (legacy.prefix) {
        processJoined = [processJoined, legacy.prefix].filter(Boolean).join("\n\n").trim();
        finalText = legacy.rest.trim();
      }
    }

    if (kind === "opencode" || kind === "hermes") {
      const promoted = promoteTrailingSummaryIfNeeded(processJoined, finalText);
      processJoined = promoted.process;
      finalText = promoted.final;
    }
  }

  const metrics = extractTrailingSessionMetricsFooter(finalText);
  if (metrics.footer) {
    processJoined = [processJoined, metrics.footer].filter(Boolean).join("\n\n").trim();
    finalText = metrics.final;
  }

  const dbgTail = extractTrailingDebuggerDisconnectNoise(finalText);
  if (dbgTail.trailer) {
    processJoined = [processJoined, dbgTail.trailer].filter(Boolean).join("\n\n").trim();
    finalText = dbgTail.final;
  }

  if (kind === "hermes" && finalText) {
    finalText = stripHermesPanelDecorations(finalText);
  }

  return { process: processJoined, final: finalText };
}

/** 原 Claude 单行工具前缀（与 isOperationOrToolLine 互补） */
function extractClaudeOnlyPrefix(text: string): { prefix: string; rest: string } {
  const lines = text.split("\n");
  let i = 0;
  const buf: string[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      if (buf.length === 0) continue;
      buf.push(line);
      continue;
    }
    const isToolish =
      /^[●▌►]/.test(t) ||
      /^(Running|Executing|Reading|Writing|Editing|Bash|Shell|Command|Tool)\b/i.test(t) ||
      /^\$\s/.test(t) ||
      /^npm\s/i.test(t) ||
      /^git\s/i.test(t);
    if (isToolish) buf.push(line);
    else break;
  }
  if (buf.length === 0) return { prefix: "", rest: text };
  const prefix = buf.join("\n").trimEnd();
  const rest = lines.slice(i).join("\n");
  return { prefix, rest };
}
