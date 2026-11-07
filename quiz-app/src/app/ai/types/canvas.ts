export type ArtifactType = "code" | "html" | "react" | "nextjs" | "document" | "image" | "markdown" | "pdf" | "word";

export interface ProjectFile {
  path: string;
  content: string;
  language?: string;
  isComplete?: boolean;
  action?: "write" | "delete";
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  files?: ProjectFile[];
  language?: string;
  version: number;
}
