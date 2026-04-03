export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  resourcePath: string; // The folder path where resources (images, videos) are saved
}

export interface Resource {
  id: string;
  type: "image" | "video" | "text";
  url: string; // Path to the generated resource
  createdAt: number;
}
