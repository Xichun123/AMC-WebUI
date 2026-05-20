import React, { useState, useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useWindowContext } from '@/contexts/WindowContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentClassName?: string;
  backdropClassName?: string;
  enterAnimationClassName?: string;
  exitAnimationClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  noPadding?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

type InertElement = HTMLElement & { inert?: boolean };

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    const style = window.getComputedStyle(element);

    return (
      !element.closest('[inert]') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      style.display !== 'none' &&
      style.visibility !== 'hidden'
    );
  });

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  contentClassName = '',
  backdropClassName = 'bg-black/60',
  enterAnimationClassName = 'modal-enter-animation',
  exitAnimationClassName = 'modal-exit-animation',
  ariaLabel,
  ariaLabelledBy,
  noPadding = false,
  initialFocusRef,
}) => {
  const [isActuallyOpen, setIsActuallyOpen] = useState(isOpen);
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const { document: targetDocument } = useWindowContext();

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional open-state sync for enter/exit animations.
      setIsActuallyOpen(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    previouslyFocusedElementRef.current = targetDocument.activeElement as HTMLElement | null;

    const focusTarget = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

      const modalNode = modalContentRef.current;
      if (!modalNode) {
        return;
      }

      const [firstFocusable] = getFocusableElements(modalNode);
      (firstFocusable ?? modalNode).focus();
    };

    focusTarget();
    window.requestAnimationFrame(focusTarget);

    return () => {
      const previousElement = previouslyFocusedElementRef.current;
      if (previousElement?.isConnected) {
        previousElement.focus();
        window.requestAnimationFrame(() => {
          if (previousElement.isConnected) {
            previousElement.focus();
          }
        });
      }
      previouslyFocusedElementRef.current = null;
    };
  }, [isOpen, targetDocument, initialFocusRef]);

  useEffect(() => {
    const modalNode = modalContentRef.current;
    if (!modalNode) {
      return undefined;
    }

    const handleAnimationEnd = (event: AnimationEvent) => {
      if (event.target === modalNode && !isOpen) {
        setIsActuallyOpen(false);
      }
    };

    modalNode.addEventListener('animationend', handleAnimationEnd);

    return () => {
      modalNode.removeEventListener('animationend', handleAnimationEnd);
    };
  }, [isOpen, isActuallyOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const modalNode = modalContentRef.current;
      if (!modalNode) {
        return;
      }

      const focusableElements = getFocusableElements(modalNode);
      if (focusableElements.length === 0) {
        event.preventDefault();
        modalNode.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = targetDocument.activeElement;

      if (!modalNode.contains(activeElement)) {
        event.preventDefault();
        firstFocusable.focus();
      } else if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    if (isOpen) {
      targetDocument.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      targetDocument.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, targetDocument]);

  useEffect(() => {
    const backdropNode = backdropRef.current;
    if (!isOpen || !backdropNode) {
      return undefined;
    }

    const targetWindow = targetDocument.defaultView ?? window;
    const siblingStates = Array.from(targetDocument.body.children)
      .filter(
        (element): element is InertElement => element !== backdropNode && element instanceof targetWindow.HTMLElement,
      )
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
      }));

    siblingStates.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });

    return () => {
      siblingStates.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) {
          element.removeAttribute('aria-hidden');
        } else {
          element.setAttribute('aria-hidden', ariaHidden);
        }
      });
    };
  }, [isOpen, targetDocument]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the click is on the backdrop itself, not on any of its children
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isActuallyOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={backdropRef}
      data-modal-backdrop="true"
      className={`fixed inset-0 z-[2100] flex items-center justify-center ${noPadding ? '' : 'p-2 sm:p-4'} ${backdropClassName}`}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalContentRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className={`${contentClassName} ${isOpen ? enterAnimationClassName : exitAnimationClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    targetDocument.body,
  );
};
