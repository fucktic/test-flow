import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const splitExecutable = (raw: string) => {
  const parts = Array.from(raw.matchAll(/"([^"]*)"|'([^']*)'|[^\s]+/g)).map((match) => {
    if (match[1] !== undefined) return match[1];
    if (match[2] !== undefined) return match[2];
    return match[0];
  });
  const executable = parts[0] || "";
  const prependArgs = parts.slice(1);
  return { executable, prependArgs };
};

const isClaudeCommand = (executable: string) =>
  /(^|[\\/])claude(?:\.(cmd|exe|bat))?$/i.test(executable.trim());

// 🔁 修复：明确区分 Claude 和非 Claude 的处理
const resolveClaudePromptToStdin = (executable: string, args: string[], cwd: string) => {
  // 🔥 关键：只有 claude 命令才走文件引用逻辑
  if (!isClaudeCommand(executable)) {
    // 对于 opencode 等其他命令，保持原有 stdin 逻辑
    const printFlagIndex = args.findIndex((arg) => arg === "-p" || arg === "--print");
    if (printFlagIndex < 0) {
      return { args, stdinText: null, tempFilePath: null };
    }

    const promptArg = args[printFlagIndex + 1];
    if (typeof promptArg !== "string") {
      return { args, stdinText: null, tempFilePath: null };
    }

    return { args, stdinText: promptArg, tempFilePath: null };
  }

  // 🔥 以下是专为 Claude 的文件引用逻辑
  const printFlagIndex = args.findIndex((arg) => arg === "-p" || arg === "--print");
  if (printFlagIndex < 0) {
    return { args, stdinText: null, tempFilePath: null };
  }

  const promptArg = args[printFlagIndex + 1];
  if (typeof promptArg !== "string") {
    return { args, stdinText: null, tempFilePath: null };
  }

  // 生成临时文件
  const tempDir = path.join(cwd, ".claude_tmp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempFileName = `claude_input_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`;
  const tempFilePath = path.join(tempDir, tempFileName);

  try {
    fs.writeFileSync(tempFilePath, promptArg, "utf8");
  } catch (writeErr) {
    console.error("Failed to write temp file for Claude:", writeErr);
    return { args, stdinText: promptArg, tempFilePath: null }; // 降级回 stdin
  }

  // 构造文件引用参数，在 -p 前插入 --permission-mode acceptEdits 授权文件写入
  const relativeFilePath = `.claude_tmp/${tempFileName}`;
  const argsWithoutPrompt = [
    ...args.slice(0, printFlagIndex),
    "--permission-mode",
    "acceptEdits",
    args[printFlagIndex], // -p / --print flag
    `@${relativeFilePath}`,
    ...args.slice(printFlagIndex + 2),
  ];

  return {
    args: argsWithoutPrompt,
    stdinText: null,
    tempFilePath,
  };
};

export async function POST(req: NextRequest) {
  let tempFilePathToCleanup: string | null = null;

  try {
    const { agentName, args, cwd } = await req.json();
    const targetCwd = cwd || process.cwd();

    const rawAgentName = typeof agentName === "string" ? agentName : "";
    const rawArgs = Array.isArray(args) ? args : [];
    const finalArgs = rawArgs.map((arg) => String(arg).replace(/\{\{PROJECT_ROOT\}\}/g, targetCwd));

    const { executable, prependArgs } = splitExecutable(rawAgentName);
    if (!executable) {
      return NextResponse.json({ success: false, error: "Invalid agent command" }, { status: 400 });
    }

    const rawSpawnArgs = [...prependArgs, ...finalArgs];
    const {
      args: spawnArgs,
      stdinText,
      tempFilePath,
    } = resolveClaudePromptToStdin(executable, rawSpawnArgs, targetCwd);

    tempFilePathToCleanup = tempFilePath;

    console.log(`Executing: ${executable} ${spawnArgs.join(" ")}`);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let isClosed = false;

        const safeEnqueue = (data: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(encoder.encode(data));
            } catch (e) {
              console.error("Stream enqueue error:", e);
            }
          }
        };

        safeEnqueue(`[系统] 🚀 启动任务: ${executable}\n\n`);

        const isWindows = process.platform === "win32";

        // 🔥 关键修复：Windows 下全局命令需要 shell:true
        let useShell = isWindows;
        let finalExecutable = executable;

        // 如果是 Windows 且命令不含路径分隔符（如直接是 'opencode'）
        if (isWindows && !/[\\/]/.test(executable)) {
          useShell = true; // 必须用 shell 解析 .cmd/.bat
        }

        const child = spawn(finalExecutable, spawnArgs, {
          cwd: targetCwd,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: useShell,
          windowsHide: true,
        });

        // 🔥 修复 stdin 处理：区分有无内容
        if (stdinText !== null && child.stdin) {
          child.stdin.end(stdinText);
        } else {
          child.stdin?.end();
        }

        child.stdout.on("data", (data) => {
          safeEnqueue(data.toString());
        });

        child.stderr.on("data", (data) => {
          safeEnqueue(data.toString());
        });

        child.on("close", (code) => {
          // 清理临时文件
          if (tempFilePathToCleanup && fs.existsSync(tempFilePathToCleanup)) {
            try {
              fs.unlinkSync(tempFilePathToCleanup);
              tempFilePathToCleanup = null;
            } catch (cleanupErr) {
              console.error("Cleanup failed:", cleanupErr);
            }
          }

          if (!isClosed) {
            if (code !== 0) {
              safeEnqueue(`\n[进程退出码: ${code}]`);
            }
            isClosed = true;
            controller.close();
          }
        });

        child.on("error", (error) => {
          if (!isClosed) {
            safeEnqueue(`\n[错误: ${error.message}]`);
            isClosed = true;
            controller.close();
          }
        });

        req.signal.addEventListener("abort", () => {
          if (!isClosed) {
            isClosed = true;
            child.kill("SIGKILL");
            // 清理临时文件
            if (tempFilePathToCleanup && fs.existsSync(tempFilePathToCleanup)) {
              try {
                fs.unlinkSync(tempFilePathToCleanup);
              } catch (cleanupErr) {
                console.error("Abort cleanup failed:", cleanupErr);
              }
            }
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    // 异常清理
    if (tempFilePathToCleanup && fs.existsSync(tempFilePathToCleanup)) {
      try {
        fs.unlinkSync(tempFilePathToCleanup);
      } catch (cleanupErr) {
        console.error("Catch cleanup failed:", cleanupErr);
      }
    }

    console.error("Execution error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
