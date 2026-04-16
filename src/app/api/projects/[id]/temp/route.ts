import { NextResponse } from "next/server";
import { saveTempFilesToProject } from "@/lib/services/upload.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const formData = await request.formData();

    const files = formData.getAll("files") as File[];
    const ids = formData.getAll("ids") as string[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const paths = await saveTempFilesToProject(id, files, ids);
    return NextResponse.json({ success: true, paths });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("Temp upload error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
