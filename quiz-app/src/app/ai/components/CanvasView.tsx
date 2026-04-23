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
  RefreshCw,
  Clock
} from "lucide-react";
import dynamic from "next/dynamic";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-50 animate-pulse" />
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const exportDefault = code.match(/export\s+default\s+function\s+(\w+)/);
  if (exportDefault) return exportDefault[1];
  const exportDefaultVar = code.match(/export\s+default\s+(\w+)\s*[;\n]/);
  if (exportDefaultVar) return exportDefaultVar[1];
  const firstComponent = code.match(/function\s+([A-Z]\w+)\s*\(/);
  if (firstComponent) return firstComponent[1];
  return "App";
}

/** Strip import/export statements for browser execution */
function stripModuleSyntax(code: string): string {
  return code
    .replace(/^import\s+.*?(?:from\s+['"].*?['"]|['"].*?['"]);?\s*$/gm, "")
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+default\s+(\w+)\s*;?/g, "")
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
const { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext, createContext, Fragment } = React;

${cleanCode}

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
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const codeEndRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false);
    };
    if (showExportMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showExportMenu]);

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
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-4 w-4 bg-emerald-100 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900">กำลังเตรียมพรีวิว...</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Generating artifact content</p>
          </div>
        </div>
      );
    }

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
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={() => setPreviewKey(k => k + 1)}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/90 backdrop-blur-md border border-gray-200 shadow-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-all active:scale-90"
              title="รีเฟรชพรีวิว"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }

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
        <div className="absolute bottom-4 right-4">
          <button
            onClick={() => setPreviewKey(k => k + 1)}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/90 backdrop-blur-md border border-gray-200 shadow-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-all active:scale-90"
            title="รีเฟรชพรีวิว"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-full flex flex-col bg-white shadow-2xl w-full border-l border-gray-100 animate-in slide-in-from-right duration-500">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200/60 bg-[#fafafa] shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-2 bg-emerald-500/10 rounded-xl shrink-0">
            {isDocType ? <FileText className="h-5 w-5 text-emerald-600" /> : <Code2 className="h-5 w-5 text-emerald-600" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-gray-900 truncate tracking-tight">
              {artifact.title}
            </h3>
            <div className="flex items-center gap-2.5 mt-0.5">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                <span>V{artifact.version}</span>
                {versions.length > 1 && (
                  <button 
                    onClick={() => setShowVersionPanel(!showVersionPanel)}
                    className="ml-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">• {artifact.type}</span>
              {!isComplete && (
                <span className="flex items-center gap-1.5 text-[10px] text-amber-600 font-black uppercase tracking-widest">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                  Streaming
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)} 
            className="h-9 w-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all active:scale-90"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button 
            onClick={onClose} 
            className="h-9 w-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Modern Tab Bar */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-1 p-1 bg-gray-100/60 rounded-2xl border border-gray-200/50 shadow-sm">
          {isDocType ? (
            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-white text-emerald-600 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-sm">
              <FileText className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              Document
            </div>
          ) : (
            <>
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                  activeTab === "preview"
                    ? "bg-white text-emerald-600 shadow-sm scale-105"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Eye className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                  activeTab === "code"
                    ? "bg-white text-emerald-600 shadow-sm scale-105"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Code2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                <span className="hidden sm:inline">Code</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button 
            onClick={handleCopy} 
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200"
          >
            {copied ? <Check className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-emerald-500" /> : <Copy className="h-3 sm:h-3.5 w-3 sm:w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>
          
          <div className="relative" ref={exportMenuRef}>
            <button
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="h-3 sm:h-3.5 w-3 sm:w-3.5 animate-spin" /> : <Download className="h-3 sm:h-3.5 w-3 sm:w-3.5" />}
              <span className="hidden sm:inline">{exporting ? "Exporting..." : "Download"}</span>
              <ChevronDown className={`h-2.5 sm:h-3 w-2.5 sm:w-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-2xl py-2 z-50 animate-in slide-in-from-top-2 duration-200">
                <button onClick={handleDownloadCode} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-emerald-600 transition-all">
                  <Code2 className="h-4 w-4 opacity-70" />
                  <span>Source Code</span>
                </button>
                <div className="border-t border-gray-50 my-1.5" />
                <button onClick={() => handleExportDoc("pdf")} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all">
                  <FileText className="h-4 w-4 text-red-500/70" />
                  <span>Export to PDF</span>
                </button>
                <button onClick={() => handleExportDoc("docx")} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-all">
                  <FileText className="h-4 w-4 text-blue-500/70" />
                  <span>Export to DOCX</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative bg-white flex flex-col">
        {/* Version History Sidebar Overlay */}
        {showVersionPanel && versions.length > 0 && (
          <div className="absolute inset-y-0 left-0 w-full sm:w-72 bg-white/95 backdrop-blur-xl border-r border-emerald-500/10 z-[60] shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Version History</span>
              <button onClick={() => setShowVersionPanel(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto h-full pb-20 px-2 pt-2 space-y-1">
              {[...versions].reverse().map((v) => (
                <button
                  key={v.id}
                  onClick={() => { onSelectVersion?.(v); setShowVersionPanel(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all group ${
                    v.id === artifact.id
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "hover:bg-emerald-50 text-gray-600 hover:text-emerald-700"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${v.id === artifact.id ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-white transition-colors'}`}>
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black tracking-tight truncate">Version {v.version}</p>
                    <p className={`text-[10px] font-bold opacity-60 uppercase tracking-tighter`}>
                      {v.id === versions[versions.length - 1].id ? "Latest Update" : "Previous State"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 relative overflow-hidden flex flex-col">
          {activeTab === "preview" && !isDocType && (
            <div className="flex-1 w-full bg-white overflow-hidden">
              {renderPreview()}
            </div>
          )}

          {activeTab === "code" && !isDocType && (
            <div className="flex-1 w-full overflow-auto bg-[#0d0d0f] font-mono text-sm relative custom-scrollbar">
              <SyntaxHighlighter
                language={artifact.type === "react" || artifact.type === "nextjs" ? "tsx" : artifact.type === "html" ? "html" : "javascript"}
                style={vscDarkPlus}
                customStyle={{ margin: 0, padding: "2rem", minHeight: "100%", background: "transparent", fontSize: "13px", lineHeight: "1.6" }}
                wrapLines={true}
                showLineNumbers={true}
              >
                {artifact.content}
              </SyntaxHighlighter>
              {!isComplete && (
                <div className="px-8 pb-8">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1.5 bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">Compiling stream...</span>
                  </div>
                </div>
              )}
              <div ref={codeEndRef} />
            </div>
          )}

          {activeTab === "document" && isDocType && (
            <div className="flex-1 w-full bg-white flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto modern-quill-container">
                <ReactQuill
                  theme="snow"
                  value={documentContent}
                  onChange={setDocumentContent}
                  className="h-full"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}