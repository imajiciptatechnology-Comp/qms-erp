"use client";

import { useEffect, useRef } from "react";

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** Tailwind max-w-* class. Defaults to "max-w-lg". */
  size?: string;
  children: React.ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell: focus trap, Escape key, ARIA dialog role, backdrop dismiss.
 * Convention: the first <h2 id="modal-title"> inside children is the accessible name.
 */
export default function ModalShell({ isOpen, onClose, size = "max-w-lg", children }: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus first focusable element after paint
    const timer = setTimeout(() => {
      const first = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)?.[0];
      first?.focus();
    }, 16);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`bg-white rounded-xl shadow-xl shadow-slate-900/20 w-full ${size} overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
