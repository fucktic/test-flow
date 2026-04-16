import { useState } from "react";

export const useUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = async (
    files: { id?: string; file: File }[],
    projectId: string,
  ): Promise<string[]> => {
    if (!files || files.length === 0) return [];

    setIsUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => {
        formData.append("files", f.file);
        if (f.id) {
          formData.append("ids", f.id);
        }
      });

      const response = await fetch(`/api/projects/${projectId}/temp`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success && result.paths) {
        return result.paths;
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (err) {
      console.error("[useUpload] Upload error:", err);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFiles, isUploading };
};
