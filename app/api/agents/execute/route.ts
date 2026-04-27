import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import enMessages from "@/messages/en.json";
import zhMessages from "@/messages/zh.json";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ExecuteAgentRequest = {
  agentName?: unknown;
  args?: unknown;
  locale?: unknown;
};

type AgentExecuteMessages = typeof zhMessages.AgentExecute;

const AGENT_EXECUTE_MESSAGES: Record<string, AgentExecuteMessages> = {
  en: enMessages.AgentExecute,
  zh: zhMessages.AgentExecute,
};

const formatMessage = (
  template: string,
  values: Record<string, string>,
) =>
  Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template,
  );

const splitExecutable = (raw: string) => {
  const parts = Array.from(raw.matchAll(/"([^"]*)"|'([^']*)'|[^\s]+/g)).map((match) => {
    if (match[1] !== undefined) return match[1];
    if (match[2] !== undefined) return match[2];
    return match[0];
  });

  return {
    executable: parts[0] ?? "",
    prependArgs: parts.slice(1),
  };
};

const logAgentExecute = (label: string, payload: Record<string, unknown>) => {
  process.stdout.write(
    `[agent-execute:${label}] ${JSON.stringify(payload, null, 2)}\n`,
  );
};

export async function POST(request: Request) {
  try {
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    logAgentExecute("request", {
      requestId,
      url: request.url,
    });
    const body = (await request.json()) as ExecuteAgentRequest;
    const rawLocale = typeof body.locale === "string" ? body.locale : "zh";
    const messages = AGENT_EXECUTE_MESSAGES[rawLocale] ?? AGENT_EXECUTE_MESSAGES.zh;
    const rawAgentName = typeof body.agentName === "string" ? body.agentName : "";
    const rawArgs = Array.isArray(body.args) ? body.args : [];
    const finalArgs = rawArgs.map((arg) =>
      String(arg).replaceAll("{{PROJECT_ROOT}}", "."),
    );
    const { executable, prependArgs } = splitExecutable(rawAgentName);

    if (!executable) {
      return NextResponse.json(
        { success: false, error: messages.invalidAgentCommand },
        { status: 400 },
      );
    }

    const spawnArgs = [...prependArgs, ...finalArgs];
    const encoder = new TextEncoder();

    logAgentExecute("spawn", {
      args: spawnArgs,
      command: [executable, ...spawnArgs],
      executable,
      locale: rawLocale,
      requestId,
    });

    const stream = new ReadableStream({
      start(controller) {
        let closed = false;

        const safeEnqueue = (data: string) => {
          if (closed) return;

          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            closed = true;
          }
        };

        safeEnqueue(formatMessage(messages.systemStart, { executable }));

        const child = spawn(executable, spawnArgs, {
          env: process.env,
          shell: process.platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });

        child.stdout.on("data", (data: Buffer) => {
          const chunk = data.toString();
          logAgentExecute("stdout", { chunk, requestId });
          safeEnqueue(chunk);
        });

        child.stderr.on("data", (data: Buffer) => {
          const chunk = data.toString();
          logAgentExecute("stderr", { chunk, requestId });
          safeEnqueue(chunk);
        });

        child.on("close", (code) => {
          if (closed) return;

          logAgentExecute("close", { code, requestId });

          if (code !== 0) {
            safeEnqueue(formatMessage(messages.processExitCode, { code: String(code) }));
          }

          closed = true;
          controller.close();
        });

        child.on("error", (error) => {
          if (closed) return;

          logAgentExecute("error", { message: error.message, requestId });
          safeEnqueue(formatMessage(messages.errorMessage, { message: error.message }));
          closed = true;
          controller.close();
        });

        request.signal.addEventListener("abort", () => {
          if (closed) return;

          closed = true;
          logAgentExecute("abort", { requestId });
          child.kill("SIGKILL");
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
