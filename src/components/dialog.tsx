"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function CenteredDialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const node = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY,
      scrollX = window.scrollX;
    const body = document.body;
    const saved = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    Object.assign(body.style, {
      position: "fixed",
      top: `-${scrollY}px`,
      left: `-${scrollX}px`,
      width: "100%",
      overflow: "hidden",
    });
    const viewport = window.visualViewport;
    const update = () => {
      node.style.setProperty("--visual-top", `${viewport?.offsetTop || 0}px`);
      node.style.setProperty("--visual-left", `${viewport?.offsetLeft || 0}px`);
      node.style.setProperty(
        "--visual-height",
        `${viewport?.height || innerHeight}px`,
      );
      node.style.setProperty(
        "--visual-width",
        `${viewport?.width || innerWidth}px`,
      );
    };
    update();
    node.showModal();
    (matchMedia("(max-width:760px)").matches
      ? node.querySelector<HTMLElement>("h2")
      : node.querySelector<HTMLElement>("input,select,textarea") ||
        node.querySelector<HTMLElement>("h2")
    )?.focus({ preventScroll: true });
    const focus = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && node.contains(active))
        active.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    const resize = () => {
      update();
      focus();
    };
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", resize);
    node.addEventListener("focusin", focus);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", resize);
      node.removeEventListener("focusin", focus);
      node.close();
      Object.assign(body.style, saved);
      window.scrollTo(scrollX, scrollY);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      else
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(
              ".quick-trigger, .section-heading .primary",
            )
            ?.focus({ preventScroll: true }),
        );
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog-shell"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-card">
        <header className="dialog-header">
          <h2 id={titleId} tabIndex={-1}>
            {title}
          </h2>
          <button type="button" aria-label="Close editor" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        <footer className="dialog-footer">{footer}</footer>
      </div>
    </dialog>
  );
}
