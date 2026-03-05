"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, ZoomIn, X } from "lucide-react";
import type { Question } from "@/types";

interface QuestionCardProps {
  question: Question;
  index: number;
  mode: "study" | "exam";
}

function ImageModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="ปิดรูปภาพ"
          className="absolute -top-3 -right-3 z-10 h-8 w-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
      </div>
    </div>
  );
}

export function QuestionCard({ question, index, mode }: QuestionCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(mode === "study");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleSelect = (choiceIndex: number) => {
    if (mode === "exam" && selectedIndex !== null) return; // can't change answer in exam mode
    setSelectedIndex(choiceIndex);
    if (mode === "exam") {
      setShowAnswer(true);
    }
  };

  const getChoiceLabel = (i: number) => {
    return String.fromCharCode(65 + i); // A, B, C, D
  };

  return (
    <div
      className={cn(
        "animate-fade-in rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300",
        index === 0 && "[animation-delay:0ms]",
        index === 1 && "[animation-delay:50ms]",
        index === 2 && "[animation-delay:100ms]",
        index === 3 && "[animation-delay:150ms]",
        index >= 4 && "[animation-delay:200ms]"
      )}
    >
      {/* Question header */}
      <div className="flex gap-3 mb-4">
        <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
          {question.id}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-gray-800 font-medium leading-relaxed pt-0.5">
            {question.text}
          </p>
          {question.imageUrl && (
            <div className="mt-3 relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={question.imageUrl}
                alt={`รูปประกอบข้อ ${question.id}`}
                className="max-w-full max-h-72 rounded-xl border border-gray-200 object-contain cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setZoomedImage(question.imageUrl!)}
              />
              <button
                onClick={() => setZoomedImage(question.imageUrl!)}
                aria-label="ขยายรูปภาพ"
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Choices */}
      <div className="space-y-2 ml-0 sm:ml-11">
        {question.choices.map((choice, i) => {
          const isSelected = selectedIndex === i;
          const isCorrect = choice.isCorrect;
          const showResult = showAnswer && (mode === "study" || selectedIndex !== null);

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={mode === "study"}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 border",
                mode === "study" && isCorrect &&
                  "bg-emerald-50 border-emerald-300 text-emerald-800",
                mode === "study" && !isCorrect &&
                  "bg-gray-50 border-gray-200 text-gray-600",
                mode === "exam" && !showResult &&
                  "bg-gray-50 border-gray-200 hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer",
                mode === "exam" && showResult && isSelected && isCorrect &&
                  "bg-emerald-50 border-emerald-400 text-emerald-800",
                mode === "exam" && showResult && isSelected && !isCorrect &&
                  "bg-red-50 border-red-400 text-red-800",
                mode === "exam" && showResult && !isSelected && isCorrect &&
                  "bg-emerald-50 border-emerald-300 text-emerald-800",
                mode === "exam" && showResult && !isSelected && !isCorrect &&
                  "bg-gray-50 border-gray-200 text-gray-500",
              )}
            >
              <span
                className={cn(
                  "shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  mode === "study" && isCorrect && "bg-emerald-200 text-emerald-800",
                  mode === "study" && !isCorrect && "bg-gray-200 text-gray-500",
                  mode === "exam" && !showResult && "bg-gray-200 text-gray-600",
                  mode === "exam" && showResult && isCorrect && "bg-emerald-300 text-emerald-900",
                  mode === "exam" && showResult && isSelected && !isCorrect && "bg-red-300 text-red-900",
                  mode === "exam" && showResult && !isSelected && !isCorrect && "bg-gray-200 text-gray-500",
                )}
              >
                {getChoiceLabel(i)}
              </span>
              <span className="flex-1">
                {choice.text}
                {choice.imageUrl && (
                  <span className="block mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={choice.imageUrl}
                      alt={`ตัวเลือก ${getChoiceLabel(i)}`}
                      className="max-w-full max-h-40 rounded-lg border border-gray-100 object-contain cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedImage(choice.imageUrl!);
                      }}
                    />
                  </span>
                )}
              </span>
              {showResult && isCorrect && (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              )}
              {showResult && isSelected && !isCorrect && (
                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Image zoom modal */}
      {zoomedImage && (
        <ImageModal
          src={zoomedImage}
          alt="รูปขยาย"
          onClose={() => setZoomedImage(null)}
        />
      )}
    </div>
  );
}
