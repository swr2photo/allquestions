"use client";

import { useState } from "react";
import { FileText, Maximize2, Minimize2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfViewerProps {
  driveFileId: string;
  title: string;
}

export function PdfViewer({ driveFileId, title }: PdfViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;
  const openUrl = `https://drive.google.com/file/d/${driveFileId}/view`;

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white p-4" : ""}>
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-700">
          <FileText className="h-5 w-5 text-red-500" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                ย่อ
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                ขยาย
              </>
            )}
          </Button>
          <a href={openUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              เปิดใน Drive
            </Button>
          </a>
        </div>
      </div>

      {/* PDF iframe */}
      <div
        className={`rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100 ${
          isFullscreen ? "h-[calc(100vh-80px)]" : "h-[70vh] min-h-125"
        }`}
      >
        <iframe
          src={previewUrl}
          className="w-full h-full"
          allow="autoplay"
          title={title}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>

      {/* Fullscreen overlay close */}
      {isFullscreen && (
        <button
          className="fixed top-2 right-2 z-60 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
          onClick={() => setIsFullscreen(false)}
          aria-label="ย่อหน้าจอ"
        >
          <Minimize2 className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
