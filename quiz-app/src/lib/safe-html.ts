/** Escape text so it can be placed inside HTML (element content or quoted attributes). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape markdown source before turning it into HTML, keeping only the one tag
 * models commonly emit inside tables (`<br>`). Everything else, including
 * <script>, event handlers and <img onerror>, is shown as plain text.
 */
export function escapeMarkdownSource(text: string): string {
  return escapeHtml(text).replace(/&lt;br\s*\/?&gt;/gi, "<br/>");
}
