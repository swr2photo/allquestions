import { Artifact, ArtifactType } from "../types/canvas";

/**
 * Parses the AI response to find and extract artifact content inside <canvas> tags.
 * Supports partial tags for streaming.
 */
export function parseArtifacts(content: string): { 
  artifact: Artifact | null; 
  cleanedContent: string;
  isComplete: boolean;
} {
  // Regex to match <canvas type="type" title="title">content</canvas>
  // We explicitly capture the closing tag to check for completeness
  const canvasRegex = /<canvas\s+type="([^"]+)"(?:\s+title="([^"]+)")?>([\s\S]*?)(<\/canvas>|$)/i;
  
  const match = content.match(canvasRegex);
  
  if (match) {
    const type = (match[1]?.toLowerCase() || "code") as ArtifactType;
    const title = match[2] || "Generated Content";
    let body = match[3] || "";
    const isComplete = match[4]?.toLowerCase() === "</canvas>";
    
    // Extract actual code if AI wrapped it in markdown inside the canvas tag
    // Often AI includes explanations before or after the code block.
    const codeBlockRegex = /```[a-zA-Z]*\s*[\r\n]([\s\S]*?)(?:```|$)/i;
    const codeMatch = body.match(codeBlockRegex);
    
    if (codeMatch) {
      body = codeMatch[1].trim();
    } else {
      // 1. Fix Markdown Leaks: Strip out ``` language tags and trailing ``` if the AI mistakenly wrapped the content
      body = body.replace(/^```[a-zA-Z]*\s*\n/im, "").replace(/\n?```\s*$/im, "").trim();
    }
    
    // The "cleanedContent" is what actually shows up in the chat bubbles
    const cleanedContent = content.replace(canvasRegex, (fullMatch) => {
      return "\n\n*(Artifact generated in Canvas)*\n\n";
    }).trim();
    
    return {
      artifact: {
        id: "active-artifact",
        type,
        title,
        content: body,
        version: 1,
      },
      cleanedContent,
      isComplete
    };
  }
  
  return { artifact: null, cleanedContent: content, isComplete: false };
}
