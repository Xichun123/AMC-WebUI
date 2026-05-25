import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const ACTION_ROW_GAP_PX = 8;
const ACTION_ROW_COMFORT_BUFFER_PX = 40;

interface AuxiliaryActionCollapseState {
  measurementSignature: string;
  shouldCollapse: boolean;
}

interface UseAuxiliaryActionCollapseOptions {
  hasAuxiliaryActions: boolean;
  measurementSignature: string;
}

export const useAuxiliaryActionCollapse = ({
  hasAuxiliaryActions,
  measurementSignature,
}: UseAuxiliaryActionCollapseOptions) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const leftActionsRef = useRef<HTMLDivElement | null>(null);
  const rightActionsRef = useRef<HTMLDivElement | null>(null);
  const expandedRightWidthRef = useRef(0);
  const [collapseState, setCollapseState] = useState<AuxiliaryActionCollapseState>({
    measurementSignature,
    shouldCollapse: false,
  });
  const shouldCollapse =
    collapseState.measurementSignature === measurementSignature ? collapseState.shouldCollapse : false;

  const measureActionRow = useCallback(() => {
    const root = rootRef.current;
    const leftActions = leftActionsRef.current;
    const rightActions = rightActionsRef.current;

    if (!root || !leftActions || !rightActions) {
      return;
    }

    if (!hasAuxiliaryActions) {
      expandedRightWidthRef.current = 0;
      setCollapseState((current) =>
        current.measurementSignature === measurementSignature && !current.shouldCollapse
          ? current
          : { measurementSignature, shouldCollapse: false },
      );
      return;
    }

    const containerWidth = root.getBoundingClientRect().width;
    const leftWidth = leftActions.getBoundingClientRect().width;
    const currentRightWidth = rightActions.getBoundingClientRect().width;

    if (containerWidth <= 0 || currentRightWidth <= 0) {
      return;
    }

    if (!shouldCollapse) {
      expandedRightWidthRef.current = currentRightWidth;
    }

    const expandedRightWidth = expandedRightWidthRef.current || currentRightWidth;
    const requiredWidth = leftWidth + expandedRightWidth + ACTION_ROW_GAP_PX + ACTION_ROW_COMFORT_BUFFER_PX;
    const nextShouldCollapse = requiredWidth > containerWidth;

    setCollapseState((current) =>
      current.measurementSignature === measurementSignature && current.shouldCollapse === nextShouldCollapse
        ? current
        : { measurementSignature, shouldCollapse: nextShouldCollapse },
    );
  }, [hasAuxiliaryActions, measurementSignature, shouldCollapse]);

  useLayoutEffect(() => {
    const animationFrameId = window.requestAnimationFrame(measureActionRow);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [measureActionRow]);

  useEffect(() => {
    const root = rootRef.current;
    const leftActions = leftActionsRef.current;
    const rightActions = rightActionsRef.current;

    if (!root || !leftActions || !rightActions) {
      return undefined;
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureActionRow);
      return () => window.removeEventListener('resize', measureActionRow);
    }

    const resizeObserver = new ResizeObserver(() => measureActionRow());
    resizeObserver.observe(root);
    resizeObserver.observe(leftActions);
    resizeObserver.observe(rightActions);

    return () => resizeObserver.disconnect();
  }, [measureActionRow]);

  return {
    rootRef,
    leftActionsRef,
    rightActionsRef,
    shouldCollapseAuxiliaryActions: shouldCollapse,
  };
};
