export type ArtifactType = "code" | "html" | "react" | "nextjs" | "document" | "image" | "markdown" | "pdf" | "word";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  version: number;
}
