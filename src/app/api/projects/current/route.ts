import { NextResponse } from "next/server";
import { getCurrentProject, setCurrentProject } from "@/lib/services/project.service";

/**
 * 获取当前选择的项目 ID
 * 注意：由于 Zustand 状态运行在前端浏览器中，服务端的 API 路由无法直接读取到它。
 * 所以我们通过本地文件 `.current-project.json` 来持久化并在服务端读取。
 */
export async function GET() {
  const currentProject = await getCurrentProject();
  return NextResponse.json({ projectId: currentProject || null });
}

/**
 * 供前端调用以同步当前项目 ID 到服务端
 */
export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    await setCurrentProject(projectId);
    return NextResponse.json({ success: true, projectId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
