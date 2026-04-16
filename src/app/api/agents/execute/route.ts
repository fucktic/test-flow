import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

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

const resolveClaudePromptToStdin = (executable: string, args: string[], cwd: string) => {
  if (!isClaudeCommand(executable)) {
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

  const printFlagIndex = args.findIndex((arg) => arg === "-p" || arg === "--print");
  if (printFlagIndex < 0) {
    return { args, stdinText: null, tempFilePath: null };
  }

  const promptArg = args[printFlagIndex + 1];
  if (typeof promptArg !== "string") {
    return { args, stdinText: null, tempFilePath: null };
  }

  const tempDir = path.join(cwd, ".claude_tmp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempFileName = `claude_input_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`;
  const tempFilePath = path.join(tempDir, tempFileName);

  try {
    fs.writeFileSync(tempFilePath, promptArg, "utf8");
  } catch (writeErr) {
    console.error("Failed to write temp file for Claude:", writeErr);
    return { args, stdinText: promptArg, tempFilePath: null };
  }

  const relativeFilePath = `.claude_tmp/${tempFileName}`;
  const argsWithoutPrompt = [
    ...args.slice(0, printFlagIndex),
    "--permission-mode",
    "acceptEdits",
    args[printFlagIndex],
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
    const { agentName, args, cwd, locale: reqLocale } = await req.json();
    const targetCwd = cwd || process.cwd();

    const locale = routing.locales.includes(reqLocale) ? reqLocale : routing.defaultLocale;
    const t = await getTranslations({ locale, namespace: "agents" });

    const rawAgentName = typeof agentName === "string" ? agentName : "";
    const rawArgs = Array.isArray(args) ? args : [];
    const finalArgs = rawArgs.map((arg) => String(arg).replace(/\{\{PROJECT_ROOT\}\}/g, targetCwd));

    const { executable, prependArgs } = splitExecutable(rawAgentName);
    if (!executable) {
      return NextResponse.json(
        { success: false, error: t("invalidAgentCommand") },
        { status: 400 },
      );
    }

    const rawSpawnArgs = [...prependArgs, ...finalArgs];
    const {
      args: spawnArgs,
      stdinText,
      tempFilePath,
    } = resolveClaudePromptToStdin(executable, rawSpawnArgs, targetCwd);

    tempFilePathToCleanup = tempFilePath;

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

        safeEnqueue(t("systemStart", { executable }));

        const isWindows = process.platform === "win32";

        let useShell = isWindows;
        const finalExecutable = executable;

        if (isWindows && !/[\\/]/.test(executable)) {
          useShell = true;
        }

        const child = spawn(finalExecutable, spawnArgs, {
          cwd: targetCwd,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: useShell,
          windowsHide: true,
        });

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
              safeEnqueue(t("processExitCode", { code: String(code) }));
            }
            isClosed = true;
            controller.close();
          }
        });

        child.on("error", (error) => {
          if (!isClosed) {
            safeEnqueue(t("errorMessage", { message: error.message }));
            isClosed = true;
            controller.close();
          }
        });

        req.signal.addEventListener("abort", () => {
          if (!isClosed) {
            isClosed = true;
            child.kill("SIGKILL");
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
  } catch (error) {
    if (tempFilePathToCleanup && fs.existsSync(tempFilePathToCleanup)) {
      try {
        fs.unlinkSync(tempFilePathToCleanup);
      } catch (cleanupErr) {
        console.error("Catch cleanup failed:", cleanupErr);
      }
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Execution error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
