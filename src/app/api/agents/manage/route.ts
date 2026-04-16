import { NextResponse } from "next/server";
import { getAgents, saveAgents } from "@/lib/services/agent.service";

// 处理获取智能体列表请求
export async function GET() {
  try {
    const agents = await getAgents();
    return NextResponse.json(agents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 处理保存智能体列表请求
export async function POST(req: Request) {
  try {
    const agents = await req.json();
    await saveAgents(agents);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
