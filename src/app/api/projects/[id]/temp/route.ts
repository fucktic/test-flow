import { NextResponse } from "next/server";
import { saveTempFilesToProject } from "@/lib/services/upload.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  console.log("==== [API Route] /api/projects/[id]/temp HIT! ====");
  try {
    const { id } = await params;
    console.log(`[API Route] Project ID resolved: ${id}`);

    const formData = await request.formData();
    console.log(`[API Route] formData keys received:`, Array.from(formData.keys()));

    // Extract all files from formData
    const files = formData.getAll("files") as File[];
    const ids = formData.getAll("ids") as string[];
    console.log(`[API Route] extracted files array length: ${files?.length || 0}`);

    if (!files || files.length === 0) {
      console.log("[API Route] No files provided in formData. Returning 400.");
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    console.log(`[API Route] Calling saveTempFilesToProject for ${files.length} files...`);
    const paths = await saveTempFilesToProject(id, files, ids);
    console.log(`[API Route] saveTempFilesToProject finished successfully. Paths:`, paths);

    return NextResponse.json({ success: true, paths });
  } catch (error: any) {
    console.error("==== [API Route] Temp upload error ====", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
