"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Eye,
  Code2,
  FileText,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Check,
  X,
  Loader2,
  ChevronDown,
  RefreshCw
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-50 animate-pulse" />
}) as any;
import "react-quill-new/dist/quill.snow.css";

import { Artifact } from "../types/canvas";

interface CanvasViewProps {
  artifact: Artifact | null;
  versions?: Artifact[];
  onSelectVersion?: (artifact: Artifact) => void;
  isOpen: boolean;
  isComplete: boolean;
  onClose: () => void;
}

type TabType = "preview" | "code" | "document";

/** Find the default-exported component name from React code */
function findComponentName(code: string): string {
  // Match: export default function ComponentName
  const exportDefault = code.match(/export\s+default\s+function\s+(\w+)/);
  if (exportDefault) return exportDefault[1];
  // Match: export default ComponentName (at end or with semicolon)
  const exportDefaultVar = code.match(/export\s+default\s+(\w+)\s*[;\n]/);
  if (exportDefaultVar) return exportDefaultVar[1];
  // Match: first function component (capitalized)
  const firstComponent = code.match(/function\s+([A-Z]\w+)\s*\(/);
  if (firstComponent) return firstComponent[1];
  return "App";
}

/** Strip import/export statements for browser execution */
function stripModuleSyntax(code: string): string {
  return code
    // Remove import statements (single and multi-line)
    .replace(/^import\s+.*?(?:from\s+['"].*?['"]|['"].*?['"]);?\s*$/gm, "")
    // Remove "export default function" → "function"
    .replace(/export\s+default\s+function\s+/g, "function ")
    // Remove "export default" at end
    .replace(/export\s+default\s+(\w+)\s*;?/g, "")
    // Remove "export " prefix from declarations
    .replace(/export\s+(const|let|var|function|class)\s+/g, "$1 ")
    .trim();
}

/** Build a self-contained HTML document that renders a React component */
function buildReactSrcDoc(code: string): string {
  const componentName = findComponentName(code);
  const cleanCode = stripModuleSyntax(code);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"><\/script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
html,body,#root{height:100%;margin:0;padding:0}
body{font-family:'Kanit',sans-serif}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react,typescript">
// Provide stub for useState etc. in global scope
const { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext, createContext, Fragment } = React;

${cleanCode}

// Render
try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(${componentName}));
} catch(e) {
  document.getElementById('root').innerHTML = '<div style="padding:20px;color:red;font-family:monospace"><b>Error:</b> ' + e.message + '</div>';
  console.error(e);
}
<\/script>
</body>
</html>`;
}

export default function CanvasView({ artifact, versions = [], onSelectVersion, isOpen, isComplete, onClose }: CanvasViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("preview");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [documentContent, setDocumentContent] = useState("");
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [prevArtifactId, setPrevArtifactId] = useState(artifact?.id);
  const [previewKey, setPreviewKey] = useState(0);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const versionMenuRef = useRef<HTMLDivElement>(null);
  const codeEndRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false);
      if (versionMenuRef.current && !versionMenuRef.current.contains(e.target as Node)) setShowVersionMenu(false);
    };
    if (showExportMenu || showVersionMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showExportMenu, showVersionMenu]);

  const isDocType = ["document", "pdf", "word", "markdown"].includes(artifact?.type?.toLowerCase() || "");

  useEffect(() => {
    if (artifact?.id !== prevArtifactId) {
      setPrevArtifactId(artifact?.id);
      setActiveTab(isDocType ? "document" : "preview");
    }
    if (isDocType && documentContent !== artifact?.content) {
      setDocumentContent(artifact?.content || "");
    }
  }, [artifact, isDocType, prevArtifactId, documentContent]);

  useEffect(() => {
    if (isPreviewReady !== isComplete) {
      setIsPreviewReady(isComplete);
    }
  }, [isComplete, isPreviewReady]);

  useEffect(() => {
    if (activeTab === "code" && codeEndRef.current) {
      codeEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [artifact?.content, activeTab]);

  if (!isOpen || !artifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const ext = artifact.type === "react" || artifact.type === "nextjs" ? "tsx"
      : artifact.type === "html" ? "html"
      : artifact.type === "document" || artifact.type === "markdown" ? "md"
      : "txt";
    const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title || "canvas"}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportDoc = async (format: "docx" | "pdf") => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const res = await fetch("/api/ai/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: isDocType ? documentContent : artifact.content,
          title: artifact.title || "document",
          format,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${artifact.title || "document"}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert(err instanceof Error ? err.message : "ไม่สามารถ Export ได้");
    } finally {
      setExporting(false);
    }
  };

  const renderPreview = () => {
    if (isDocType) return null;

    if (!isPreviewReady) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-white gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">กำลังสร้างพรีวิว...</p>
          <p className="text-xs opacity-60">พรีวิวจะแสดงผลเมื่อโค้ดเขียนเสร็จสมบูรณ์</p>
        </div>
      );
    }

    // React / Next.js — self-hosted iframe with Babel + React CDN
    if (artifact.type === "react" || artifact.type === "nextjs") {
      const srcDoc = buildReactSrcDoc(artifact.content);
      return (
        <div className="h-full w-full bg-white flex flex-col relative">
          <iframe
            key={previewKey}
            title="React Preview"
            srcDoc={srcDoc}
            className="w-full flex-1 border-none bg-white"
            sandbox="allow-scripts allow-modals"
          />
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <button
              onClick={() => setPreviewKey(k => k + 1)}
              className="p-1.5 rounded-md bg-white/90 border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
              title="รีเฟรช"
            >
              <RefreshCw className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </div>
        </div>
      );
    }

    // HTML — direct iframe
    const srcDoc = artifact.content.includes("<!DOCTYPE") || artifact.content.includes("<html")
      ? artifact.content
      : `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>body{font-family:'Kanit',sans-serif;padding:20px;margin:0}</style>
</head>
<body>${artifact.content}</body>
</html>`;

    return (
      <div className="h-full w-full bg-white flex flex-col relative">
        <iframe
          key={previewKey}
          title="HTML Preview"
          srcDoc={srcDoc}
          className="w-full flex-1 border-none bg-white"
          sandbox="allow-scripts allow-modals"
        />
        <div className="absolute bottom-3 right-3">
          <button
            onClick={() => setPreviewKey(k => k + 1)}
            className="p-1.5 rounded-md bg-white/90 border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
            title="รีเฟรช"
          >
            <RefreshCw className="h-3.5 w-3.5 text-gray-600" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-full flex flex-col bg-white shadow-xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
            {isDocType ? <FileText className="h-4 w-4 text-primary" /> : <Code2 className="h-4 w-4 text-primary" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">
              {artifact.title}
            </h3>
            <div className="flex items-center gap-2">
              {/* Version selector */}
              {versions.length > 1 ? (
                <div className="relative" ref={versionMenuRef}>
                  <button
                    onClick={() => setShowVersionMenu(!showVersionMenu)}
                    className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider hover:text-gray-900 transition-colors"
                  >
                    V{artifact.version} <ChevronDown className="h-3 w-3" />
                  </button>
                  {showVersionMenu && (
                    <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden z-50">
                      <div className="max-h-48 overflow-y-auto py-1">
                        {versions.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => { onSelectVersion?.(v); setShowVersionMenu(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                              v.id === artifact.id
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            Version {v.version} {v.id === versions[versions.length - 1].id && "(ล่าสุด)"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  V{artifact.version}
                </p>
              )}
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">• {artifact.type}</p>
              {!isComplete && (
                <span className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                  <span className="h-1 w-1 rounded-full bg-amber-500 animate-pulse" />
                  Streaming...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="h-8 w-8 text-gray-500 hover:text-gray-900">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-500 hover:text-gray-900">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div>
          {isDocType ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
              <FileText className="h-3.5 w-3.5" />
              เอกสาร
            </div>
          ) : (
            <div className="flex items-center bg-gray-100/80 p-0.5 rounded-full border border-gray-200/60 shadow-sm">
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  activeTab === "preview"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                พรีวิว
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  activeTab === "code"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                โค้ด
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1.5 text-gray-600 hover:text-gray-900">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </Button>
          <div className="relative" ref={exportMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-gray-600 hover:text-gray-900"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? "กำลัง Export..." : "ดาวน์โหลด"}
              <ChevronDown className="h-3 w-3" />
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <button onClick={handleDownloadCode} className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors">
                  <Code2 className="h-4 w-4 text-gray-500" />
                  <span>ไฟล์โค้ด</span>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => handleExportDoc("pdf")} className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors">
                  <FileText className="h-4 w-4 text-red-500" />
                  <span>Export PDF</span>
                </button>
                <button onClick={() => handleExportDoc("docx")} className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span>Export DOCX</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative bg-gray-50">
        {activeTab === "preview" && !isDocType && (
          <div className="h-full w-full overflow-hidden bg-white">
            {renderPreview()}
          </div>
        )}

        {activeTab === "code" && !isDocType && (
          <div className="h-full w-full overflow-auto bg-[#1E1E1E] font-mono text-sm relative">
            <SyntaxHighlighter
              language={artifact.type === "react" || artifact.type === "nextjs" ? "tsx" : artifact.type === "html" ? "html" : "javascript"}
              style={vscDarkPlus}
              customStyle={{ margin: 0, padding: "1rem", minHeight: "100%", background: "transparent", fontSize: "13px" }}
              wrapLines={true}
              showLineNumbers={true}
            >
              {artifact.content}
            </SyntaxHighlighter>
            {!isComplete && (
              <div className="px-4 pb-4">
                <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse align-middle" />
              </div>
            )}
            <div ref={codeEndRef} />
          </div>
        )}

        {activeTab === "document" && isDocType && (
          <div className="h-full w-full bg-white flex flex-col overflow-hidden">
            <ReactQuill
              theme="snow"
              value={documentContent}
              onChange={setDocumentContent}
              className="flex-1 overflow-y-auto"
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                  ['link', 'image', 'code-block'],
                  ['clean']
                ],
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
