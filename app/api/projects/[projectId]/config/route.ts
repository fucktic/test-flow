import { NextResponse } from "next/server";
import type {
  ProjectSelectedModelInfo,
  ProjectSelectedModelType,
} from "@/lib/project-types";
import {
  getProjectConfig,
  saveProjectSelectedModel,
} from "@/lib/services/project-service";

function toErrorResponse() {
  return NextResponse.json({ message: "project-config:error" }, { status: 400 });
}

function readModelType(value: unknown): ProjectSelectedModelType | null {
  return value === "image" || value === "video" ? value : null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseSelectedModel(value: unknown): ProjectSelectedModelInfo | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const id = readOptionalString(record.id);
  const name = readOptionalString(record.name);
  const apiKey = readOptionalString(record.apiKey);
  const example = readOptionalString(record.example);
  const type = readModelType(record.type);

  if (!id || !name || !apiKey || !example || !type) return null;

  return {
    apiKey,
    example,
    id,
    name,
    selectedAt: new Date().toISOString(),
    type,
    ...(type === "video"
      ? { videoReferenceMode: readOptionalString(record.videoReferenceMode) ?? "all-purpose" }
      : {}),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const result = await getProjectConfig(projectId);
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ config: result.config });
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
    const body = (await request.json()) as { selectedModel?: unknown };
    const selectedModel = parseSelectedModel(body.selectedModel);
    if (!selectedModel) return toErrorResponse();

    const result = await saveProjectSelectedModel({ projectId, model: selectedModel });
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ config: result.config });
  } catch {
    return toErrorResponse();
  }
}
