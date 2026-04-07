import { useState } from "react";

export const useUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = async (files: { file: File }[], projectId: string): Promise<string[]> => {
    console.log(
      `[useUpload] Started uploadFiles hook. File count: ${files?.length}, projectId: ${projectId}`,
    );
    if (!files || files.length === 0) return [];

    setIsUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f, index) => {
        console.log(
          `[useUpload] Appending file ${index} to FormData: name=${f.file.name}, type=${f.file.type}`,
        );
        formData.append("files", f.file);
      });

      console.log(`[useUpload] Sending POST request to /api/projects/${projectId}/temp ...`);
      const response = await fetch(`/api/projects/${projectId}/temp`, {
        method: "POST",
        body: formData,
      });

      console.log(`[useUpload] Received response. Status: ${response.status}`);
      const result = await response.json();
      console.log(`[useUpload] Response JSON:`, result);

      if (response.ok && result.success && result.paths) {
        return result.paths;
      } else {
        throw new Error(result.error || "未知错误");
      }
    } catch (err) {
      console.error(`[useUpload] Fetch threw an error:`, err);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFiles, isUploading };
};
