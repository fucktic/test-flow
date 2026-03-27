import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 允许最长 5 分钟的执行时间（如果部署在 Vercel 等平台会有用）

export async function POST(req: NextRequest) {
  try {
    const { agentName, command, cwd } = await req.json();

    // 实际应根据 agentName 组装安全命令
    const fullCommand = `${agentName} ${command}`;

    // 处理 cwd，如果未提供则使用当前项目目录
    const targetCwd = cwd || process.cwd();

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let isClosed = false;

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

        // 【关键修复2】：stdio 设置 ignore 忽略 stdin，防止命令等待用户输入（例如 y/n）而无限挂起
        const child = spawn(fullCommand, {
          shell: true,
          cwd: targetCwd,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout.on("data", (data) => {
          safeEnqueue(data.toString());
        });

        child.stderr.on("data", (data) => {
          safeEnqueue(data.toString());
        });

        child.on("close", (code) => {
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
