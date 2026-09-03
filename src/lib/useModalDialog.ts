'use client';
import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Minimal dialog behavior for modals rendered via a body-level portal:
 * - focuses the first focusable element when opened,
 * - traps Tab + Shift+Tab inside the panel,
 * - closes on Escape,
 * - marks all other top-level body content `inert` while open,
 * - restores focus to the previously focused element on close.
 */
export function useModalDialog(isOpen: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;

    const getFocusables = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.tabIndex >= 0
          )
        : [];

    getFocusables()[0]?.focus();

    const inerted: HTMLElement[] = [];
    for (const node of Array.from(document.body.children)) {
      const el = node as HTMLElement;
      // Skip the panel itself AND its ancestors/quasi-parents. The panel may be
      // nested inside a portal root that also carries the backdrop and the Exit /
      // enter-transition wrapper; blurring that container would freeze the whole
      // modal (everything except Escape stops working). Only inert siblings that
      // genuinely do NOT contain the interactive panel.
      if (el !== panel && !el.contains(panel)) {
        el.inert = true;
        inerted.push(el);
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = getFocusables();
      const active = document.activeElement as HTMLElement | null;
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && (active === first || !panel?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      for (const el of inerted) el.inert = false;
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  return panelRef;
}