import { NextResponse } from "next/server";
import { getAgents, saveAgents } from "@/lib/services/agent.service";

// 处理获取智能体列表请求
export async function GET() {
  try {
    const agents = await getAgents();
    return NextResponse.json(agents);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 处理保存智能体列表请求
export async function POST(req: Request) {
  try {
    const agents = await req.json();
    await saveAgents(agents);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
