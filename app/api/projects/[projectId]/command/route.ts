import { NextResponse } from "next/server";
import {
  clearProjectCommands,
  getProjectCommands,
  saveProjectCommandStatus,
  type ProjectCommandStatus,
} from "@/lib/services/project-service";

const COMMAND_STATUSES = new Set<ProjectCommandStatus>(["loading", "error", "success"]);

function toErrorResponse() {
  return NextResponse.json({ message: "project-command:error" }, { status: 400 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const result = await getProjectCommands(projectId);
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ commands: result.commands });
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
    const body = (await request.json()) as { gridId?: string; status?: string };

    if (!body.gridId || !body.status || !COMMAND_STATUSES.has(body.status as ProjectCommandStatus)) {
      return toErrorResponse();
    }

    const result = await saveProjectCommandStatus({
      gridId: body.gridId,
      projectId,
      status: body.status as ProjectCommandStatus,
    });
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ commands: result.commands });
  } catch {
    return toErrorResponse();
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const result = await clearProjectCommands(projectId);
    if (!result.success) return toErrorResponse();

    return NextResponse.json({ ok: true });
  } catch {
    return toErrorResponse();
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return DELETE(_request, context);
}
