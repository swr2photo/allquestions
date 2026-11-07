import { Artifact, ArtifactType, ProjectFile } from "../types/canvas";

/**
 * Parses attributes from a tag string (e.g., 'path="App.tsx" language="tsx"')
 */
function parseAttributes(tagStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-z]+)=["']?([^"'\s>]+)["']?/gi;
  let match;
  while ((match = regex.exec(tagStr)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

/**
 * Parses the AI response to find and extract artifact content.
 */
export function parseArtifacts(content: string): { 
  artifact: Artifact | null; 
  cleanedContent: string;
  isComplete: boolean;
} {
  // Regex to match ALL canvas and file tags
  const canvasRegex = /<canvas\s+([^>]*?)>([\s\S]*?)(?:<\/canvas>|$)/gi;
  const fileRegex = /<file\s+([^>]*?)>([\s\S]*?)(?:<\/file>|$)/gi;
  
  // Partial tag cleaning regex (to hide ugly tags being typed)
  const partialTagRegex = /<(canvas|file)[^>]*?$/i;

  const canvasMatches = Array.from(content.matchAll(canvasRegex));
  const combinedFiles: ProjectFile[] = [];
  let lastType: ArtifactType = "code";
  let lastTitle = "Generated Content";
  let lastBody = "";
  let isComplete = true;

  // 1. Process Canvas Blocks
  if (canvasMatches.length > 0) {
    canvasMatches.forEach((match) => {
      const attrs = parseAttributes(match[1]);
      const type = (attrs.type?.toLowerCase() || "code") as ArtifactType;
      const title = attrs.title || "Generated Content";
      let body = match[2] || "";
      const blockIsComplete = match[0].endsWith("</canvas>");
      
      if (!blockIsComplete) isComplete = false;
      
      lastType = type;
      lastTitle = title;
      lastBody = body;

      let processedBody = body.trim();
      if (processedBody.startsWith("```")) {
          const firstNewLine = processedBody.indexOf("\n");
          if (firstNewLine !== -1) processedBody = processedBody.slice(firstNewLine + 1);
          if (processedBody.endsWith("```")) processedBody = processedBody.slice(0, -3);
      }

      const innerFileMatches = Array.from(processedBody.matchAll(fileRegex));
      if (innerFileMatches.length > 0) {
        innerFileMatches.forEach(m => {
          const fileAttrs = parseAttributes(m[1]);
          if (fileAttrs.path) {
            combinedFiles.push({
              path: fileAttrs.path,
              language: fileAttrs.language || "typescript",
              action: (fileAttrs.action as any) || "write",
              content: m[2].trim(),
              isComplete: m[0].endsWith("</file>")
            });
          }
        });
      } else {
        const defaultPath = type === "react" || type === "nextjs" ? "App.tsx" : type === "html" ? "index.html" : "Document.md";
        combinedFiles.push({
          path: defaultPath,
          language: type === "react" || type === "nextjs" ? "tsx" : type === "html" ? "html" : "markdown",
          action: "write",
          content: processedBody,
          isComplete: blockIsComplete
        });
      }
    });
  }

  // 2. Process Standalone File Tags
  const standaloneFileMatches = Array.from(content.matchAll(fileRegex));
  if (standaloneFileMatches.length > 0) {
    standaloneFileMatches.forEach(m => {
      const fileAttrs = parseAttributes(m[1]);
      if (fileAttrs.path && !combinedFiles.some(f => f.path === fileAttrs.path && f.content === m[2].trim())) {
        combinedFiles.push({
          path: fileAttrs.path,
          language: fileAttrs.language || "typescript",
          action: (fileAttrs.action as any) || "write",
          content: m[2].trim(),
          isComplete: m[0].endsWith("</file>")
        });
      }
    });
  }

  if (combinedFiles.length > 0) {
    if (canvasMatches.length === 0) {
        isComplete = content.includes("</canvas>") || combinedFiles.every(f => f.isComplete);
    }

    let cleaned = content
      .replace(canvasRegex, "")
      .replace(fileRegex, "")
      .replace(partialTagRegex, "") // Remove partial tags at the very end
      .trim();
    
    cleaned = (cleaned ? cleaned + "\n\n" : "") + "*(Artifact generated in Canvas)*";

    return {
      artifact: {
        id: "active-artifact",
        type: lastType,
        title: lastTitle,
        content: lastBody,
        files: combinedFiles,
        version: 1,
      },
      cleanedContent: cleaned,
      isComplete
    };
  }
  
  return { artifact: null, cleanedContent: content.replace(partialTagRegex, ""), isComplete: false };
}
