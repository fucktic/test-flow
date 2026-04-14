import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { createReadStream } from "fs";
import { unlink, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 允许最长 5 分钟的执行时间（如果部署在 Vercel 等平台会有用）

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

const resolveClaudePromptToStdinFile = async (executable: string, args: string[]) => {
  if (executable.toLowerCase() !== "claude") {
    return { args, stdinFilePath: null as string | null };
  }

  const printFlagIndex = args.findIndex((arg) => arg === "-p" || arg === "--print");
  if (printFlagIndex < 0) {
    return { args, stdinFilePath: null as string | null };
  }

  const promptArg = args[printFlagIndex + 1];
  if (typeof promptArg !== "string" || promptArg.length === 0) {
    return { args, stdinFilePath: null as string | null };
  }

  const promptFilePath = join(
    tmpdir(),
    `node-flow-claude-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
  );
  await writeFile(promptFilePath, promptArg, "utf8");

  const argsWithoutPrompt = [
    ...args.slice(0, printFlagIndex + 1),
    ...args.slice(printFlagIndex + 2),
  ];
  return { args: argsWithoutPrompt, stdinFilePath: promptFilePath };
};

export async function POST(req: NextRequest) {
  try {
    const { agentName, args, cwd } = await req.json();

    // 处理 cwd，如果未提供则使用当前项目目录
    const targetCwd = cwd || process.cwd();

    const rawAgentName = typeof agentName === "string" ? agentName : "";
    const rawArgs = Array.isArray(args) ? args : [];

    // 替换绝对路径占位符
    const finalArgs = rawArgs.map((arg) => String(arg).replace(/\{\{PROJECT_ROOT\}\}/g, targetCwd));

    const { executable, prependArgs } = splitExecutable(rawAgentName);
    if (!executable) {
      return NextResponse.json({ success: false, error: "Invalid agent command" }, { status: 400 });
    }

    const rawSpawnArgs = [...prependArgs, ...finalArgs];
    const { args: spawnArgs, stdinFilePath } = await resolveClaudePromptToStdinFile(
      executable,
      rawSpawnArgs,
    );
    console.log(`Executing command: ${executable} ${spawnArgs.join(" ")}`);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let isClosed = false;
        let cleanedTempFile = false;

        const cleanupPromptFile = async () => {
          if (!stdinFilePath || cleanedTempFile) return;
          cleanedTempFile = true;
          try {
            await unlink(stdinFilePath);
          } catch {
            // 忽略临时文件清理失败，避免影响主流程
          }
        };

        // 为了避免在 controller.close() 后继续 enqueue 报错
        const safeEnqueue = (data: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(encoder.encode(data));
            } catch (e) {
              console.error("Stream enqueue error:", e);
            }
          }
        };

        // 【关键修复1】：立即发送第一段数据！这会强制 Next.js 立即刷新 HTTP 响应头，结束浏览器的 Pending 状态
        safeEnqueue(`[系统] 🚀 正在启动任务...\n\n`);

        // 使用参数数组执行，避免 Windows shell 对单引号和换行的截断问题
        const child = spawn(executable, spawnArgs, {
          cwd: targetCwd,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
          windowsHide: true,
        });

        if (stdinFilePath && child.stdin) {
          const promptStream = createReadStream(stdinFilePath, { encoding: "utf8" });
          promptStream.on("error", () => {
            child.stdin?.end();
          });
          promptStream.pipe(child.stdin);
          promptStream.on("close", () => {
            void cleanupPromptFile();
          });
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
          void cleanupPromptFile();
          if (!isClosed) {
            if (code !== 0) {
              safeEnqueue(`\n[Process exited with code ${code}]`);
            }
            isClosed = true;
            try {
              controller.close();
            } catch (e) {
              console.error("Stream close error:", e);
            }
          }
        });

        child.on("error", (error) => {
          void cleanupPromptFile();
          if (!isClosed) {
            safeEnqueue(`\n[Error: ${error.message}]`);
            isClosed = true;
            try {
              controller.close();
            } catch (e) {
              console.error("Stream close error:", e);
            }
          }
        });

        // 如果客户端主动断开连接，我们需要杀死子进程
        req.signal.addEventListener("abort", () => {
          void cleanupPromptFile();
          if (!isClosed) {
            isClosed = true;
            child.kill("SIGKILL");
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
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Execution error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
