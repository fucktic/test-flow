import { NextResponse } from "next/server";
import {
  addExistingImageToProjectAssets,
  addProjectImageToStoryboard,
  createProjectImage,
  deleteProjectImage,
  getProjectImages,
  updateProjectImageFile,
} from "@/lib/services/project-service";

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

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const formData = await request.formData();
    const category = formData.get("category");
    const name = formData.get("name");
    const prompt = formData.get("prompt");
    const source = formData.get("source");
    const parentId = formData.get("parentId");
    const file = formData.get("file");

    if (
      typeof category !== "string" ||
      typeof name !== "string" ||
      typeof prompt !== "string" ||
      typeof source !== "string"
    ) {
      return toErrorResponse();
    }

    const image =
      file instanceof File && file.size > 0
        ? {
            buffer: Buffer.from(await file.arrayBuffer()),
            contentType: file.type,
            name: file.name,
          }
        : undefined;

    const result = await createProjectImage({
      projectId,
      image: {
        category,
        image,
        name,
        parentId: typeof parentId === "string" && parentId ? parentId : undefined,
        prompt,
        source,
      },
    });
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ image: result.image, images: result.images, project: result.project });
  } catch {
    return toErrorResponse();
  }
}

export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const formData = await request.formData();
    const imageId = formData.get("imageId");
    const file = formData.get("file");
    if (typeof imageId !== "string" || !(file instanceof File) || file.size === 0) {
      return toErrorResponse();
    }

    const result = await updateProjectImageFile({
      projectId,
      imageId,
      file: {
        buffer: Buffer.from(await file.arrayBuffer()),
        contentType: file.type,
        name: file.name,
      },
    });
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ image: result.image, images: result.images });
  } catch {
    return toErrorResponse();
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as {
      action?: unknown;
      category?: unknown;
      imageId?: unknown;
      parentId?: unknown;
      storyboardId?: unknown;
    };
    if (
      body.action === "storyboard" &&
      typeof body.storyboardId === "string" &&
      typeof body.imageId === "string"
    ) {
      const result = await addProjectImageToStoryboard({
        imageId: body.imageId,
        projectId,
        storyboardId: body.storyboardId,
      });
      if (!result.success) return toErrorResponse();

      return NextResponse.json({
        episodeId: result.episodeId,
        storyboards: result.storyboards,
      });
    }

    if (typeof body.category !== "string" || typeof body.imageId !== "string") {
      return toErrorResponse();
    }

    const result = await addExistingImageToProjectAssets({
      category: body.category,
      imageId: body.imageId,
      parentId: typeof body.parentId === "string" && body.parentId ? body.parentId : undefined,
      projectId,
    });
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ project: result.project });
  } catch {
    return toErrorResponse();
  }
}
