import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../cn.ts";

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  /** Footer node, usually the action Buttons. */
  footer?: ReactNode;
  width?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Centered modal over a blurred, rain-dimming scrim.
 *
 * Built on the native `<dialog>` element, which is what supplies the focus trap,
 * the inert background, Escape-to-close and top-layer stacking. Reimplementing
 * those on a `<div>` is a well-known way to ship a modal a keyboard user can Tab
 * straight out of.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
  className,
  style,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Fires for Escape as well as `close()`, so the parent's state cannot get
      // stuck open after the browser has already dismissed the dialog.
      onClose={() => onClose?.()}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
      onClick={(event) => {
        // A click landing on the dialog element itself is a backdrop click; the
        // panel inside stops its own.
        if (event.target === ref.current) onClose?.();
      }}
      className={cn(
        "m-auto bg-transparent p-0 text-body",
        "backdrop:bg-overlay backdrop:backdrop-blur-[2px]",
        className,
      )}
      style={{ maxWidth: "calc(100vw - var(--space-5))", ...style }}
    >
      <div
        className="rounded-md border border-line bg-surface-2 shadow-elev-2"
        style={{ width }}
        onClick={(event) => event.stopPropagation()}
      >
        {title && (
          <h2 className="border-b border-line px-5 py-4 font-display text-md tracking-wider uppercase">
            {title}
          </h2>
        )}
        <div className="px-5 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-line px-5 py-4">{footer}</div>
        )}
      </div>
    </dialog>
  );
}
