import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { agentName, command, cwd } = await req.json();

    // 在生产环境，需要严格验证命令，避免命令注入风险。
    // 因为这里要求"需要把用户输入的命令通过终端给各种agent"，所以暂时直接执行
    // 实际应根据 agentName 组装安全命令
    const fullCommand = `${agentName} ${command}`;

    const { stdout, stderr } = await execAsync(fullCommand, { cwd });

    return NextResponse.json({
      success: true,
      stdout,
      stderr,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
