import { NextResponse } from "next/server";
import { deleteProjectImage, getProjectImages } from "@/lib/services/project-service";

function toErrorResponse() {
  return NextResponse.json({ message: "project-images:error" }, { status: 400 });
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const result = await getProjectImages(projectId);
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ images: result.images });
  } catch {
    return toErrorResponse();
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");
    if (!imageId) return toErrorResponse();

    const result = await deleteProjectImage({ projectId, imageId });
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ images: result.images });
  } catch {
    return toErrorResponse();
  }
}
