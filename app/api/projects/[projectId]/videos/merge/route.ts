import { NextResponse } from "next/server";
import { mergeProjectVideos } from "@/lib/services/project-service";

function toErrorResponse(message = "project-videos-merge:error") {
  return NextResponse.json({ message }, { status: 400 });
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as { videoIds?: unknown };
    const videoIds = Array.isArray(body.videoIds)
      ? body.videoIds.filter((videoId): videoId is string => typeof videoId === "string")
      : [];

    const result = await mergeProjectVideos({ projectId, videoIds });
    if (!result.success) return toErrorResponse(result.error);

    return NextResponse.json({ video: result.video, videos: result.videos });
  } catch {
    return toErrorResponse();
  }
}
