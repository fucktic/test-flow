import { NextResponse } from "next/server";
import { flowStateSchema } from "@/lib/flow-schema";
import { getProjectCanvasData, saveProjectFlow } from "@/lib/services/project-service";

function toErrorResponse() {
  return NextResponse.json({ message: "project-flow:error" }, { status: 400 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const { searchParams } = new URL(request.url);
    const episodeId = searchParams.get("episodeId");
    if (!episodeId) return toErrorResponse();

    const result = await getProjectCanvasData({ projectId, episodeId });
    if (!result.success) return toErrorResponse();

    return NextResponse.json({
      flow: result.flow,
      storyboards: result.storyboards,
      images: result.images,
      videos: result.videos,
    });
  } catch {
    return toErrorResponse();
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as unknown;
    const parsedFlow = flowStateSchema.safeParse(body);
    if (!parsedFlow.success) return toErrorResponse();

    const result = await saveProjectFlow({ projectId, flow: parsedFlow.data });
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ flow: result.flow });
  } catch {
    return toErrorResponse();
  }
}
