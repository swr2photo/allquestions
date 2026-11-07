"use client";

// Promise-based replacements for window.confirm / window.prompt / window.alert,
// rendered with the app's own Dialog so they match the rest of the UI.
//
//   const confirm = useConfirm();
//   if (await confirm({ title: "ลบตาราง?", tone: "danger" })) …
//   const name = await usePrompt()({ title: "ตั้งชื่อโฟลเดอร์" });

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, HelpCircle, Info, Trash2 } from "lucide-react";
import { Dialog, dialogButton } from "./dialog";

type Tone = "default" | "danger" | "warning" | "info";

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
  icon?: ReactNode;
}

export interface PromptOptions extends ConfirmOptions {
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  maxLength?: number;
  /** return an error message to block submit */
  validate?: (value: string) => string | null;
  /** show value as read-only with a copy button (e.g. share links) */
  copyOnly?: boolean;
}

type NewRequest =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void }
  | { kind: "alert"; opts: ConfirmOptions; resolve: () => void };

type Request = NewRequest & { id: number };

let nextRequestId = 1;

interface Ctx {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
  alert: (o: ConfirmOptions) => Promise<void>;
}

const DialogsContext = createContext<Ctx | null>(null);

const TONE: Record<Tone, { bubble: string; button: string; icon: ReactNode }> = {
  default: { bubble: "bg-emerald-100 text-emerald-700", button: dialogButton.primary, icon: <HelpCircle className="h-5 w-5" /> },
  info: { bubble: "bg-sky-100 text-sky-700", button: dialogButton.primary, icon: <Info className="h-5 w-5" /> },
  warning: { bubble: "bg-amber-100 text-amber-700", button: dialogButton.warning, icon: <AlertTriangle className="h-5 w-5" /> },
  danger: { bubble: "bg-red-100 text-red-600", button: dialogButton.danger, icon: <Trash2 className="h-5 w-5" /> },
};

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Request[]>([]);
  const [closing, setClosing] = useState(false);
  const current = queue[0];

  const push = useCallback((r: NewRequest) => {
    const id = nextRequestId++;
    setQueue((q) => [...q, { ...r, id } as Request]);
  }, []);
  const finish = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setClosing(false);
    }, 180);
  }, []);

  const api = useMemo<Ctx>(
    () => ({
      confirm: (opts) => new Promise<boolean>((resolve) => push({ kind: "confirm", opts, resolve })),
      prompt: (opts) => new Promise<string | null>((resolve) => push({ kind: "prompt", opts, resolve })),
      alert: (opts) => new Promise<void>((resolve) => push({ kind: "alert", opts, resolve })),
    }),
    [push]
  );

  return (
    <DialogsContext.Provider value={api}>
      {children}
      {current && (
        <RequestDialog
          key={current.id}
          req={current}
          open={!closing}
          onDone={finish}
        />
      )}
    </DialogsContext.Provider>
  );
}

function RequestDialog({ req, open, onDone }: { req: Request; open: boolean; onDone: () => void }) {
  const tone = TONE[req.opts.tone ?? "default"];
  const [value, setValue] = useState(req.kind === "prompt" ? (req.opts.defaultValue ?? "") : "");
  const [touched, setTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const cancel = () => {
    if (req.kind === "confirm") req.resolve(false);
    else if (req.kind === "prompt") req.resolve(null);
    else req.resolve();
    onDone();
  };

  const error = req.kind === "prompt" && !req.opts.copyOnly ? (req.opts.validate?.(value) ?? null) : null;

  const ok = () => {
    if (req.kind === "confirm") req.resolve(true);
    else if (req.kind === "prompt") {
      if (req.opts.copyOnly) {
        req.resolve(value);
      } else {
        setTouched(true);
        if (error) return;
        req.resolve(value.trim());
      }
    } else req.resolve();
    onDone();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      inputRef.current?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const confirmText =
    req.opts.confirmText ?? (req.kind === "alert" ? "ตกลง" : req.kind === "prompt" ? (req.opts.copyOnly ? "เสร็จสิ้น" : "บันทึก") : "ยืนยัน");

  return (
    <Dialog
      open={open}
      onClose={cancel}
      size="sm"
      title={req.opts.title}
      description={req.opts.description}
      icon={req.opts.icon ?? (req.kind === "prompt" ? undefined : tone.icon)}
      iconClassName={tone.bubble}
      initialFocus={req.kind === "prompt" ? inputRef : confirmRef}
      footer={
        <>
          {req.kind !== "alert" && !(req.kind === "prompt" && req.opts.copyOnly) && (
            <button type="button" onClick={cancel} className={dialogButton.secondary}>
              {req.opts.cancelText ?? "ยกเลิก"}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={ok}
            disabled={touched && !!error}
            className={tone.button}
          >
            {confirmText}
          </button>
        </>
      }
    >
      {req.kind === "prompt" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ok();
          }}
          className="space-y-1.5"
        >
          {req.opts.label && <label className="text-xs font-medium text-gray-600">{req.opts.label}</label>}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={value}
              readOnly={req.opts.copyOnly}
              maxLength={req.opts.maxLength ?? 120}
              onFocus={(e) => req.opts.copyOnly && e.currentTarget.select()}
              onChange={(e) => {
                setValue(e.target.value);
                setTouched(true);
              }}
              placeholder={req.opts.placeholder}
              className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            {req.opts.copyOnly && (
              <button type="button" onClick={copy} className={dialogButton.secondary} aria-label="คัดลอก">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
          </div>
          {touched && error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}
    </Dialog>
  );
}

function fallback(): Ctx {
  return {
    confirm: async (o) => window.confirm(typeof o.title === "string" ? o.title : "ยืนยัน?"),
    prompt: async (o) => window.prompt(typeof o.title === "string" ? o.title : "", o.defaultValue ?? ""),
    alert: async (o) => window.alert(typeof o.title === "string" ? o.title : ""),
  };
}

export function useDialogs(): Ctx {
  return useContext(DialogsContext) ?? fallback();
}

export function useConfirm() {
  return useDialogs().confirm;
}

export function usePrompt() {
  return useDialogs().prompt;
}
