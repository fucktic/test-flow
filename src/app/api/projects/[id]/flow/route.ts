import { NextResponse } from "next/server";
import { saveFlow, loadFlow } from "@/lib/services/project.service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flow = await loadFlow(id);
  if (!flow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(flow);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    await saveFlow(id, data);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
