'use client';

import { useRef, useState, useCallback, type ReactNode } from 'react';

export interface BottomSheetProps {
  children: ReactNode;
}

type SnapState = 'collapsed' | 'half' | 'full';

const PEEK_HEIGHT = 100;
const HALF_RATIO = 0.5;
const FULL_RATIO = 0.9;

function getSnapHeight(
  snap: SnapState,
  containerHeight: number,
): number {
  switch (snap) {
    case 'collapsed':
      return PEEK_HEIGHT;
    case 'half':
      return containerHeight * HALF_RATIO;
    case 'full':
      return containerHeight * FULL_RATIO;
  }
}

function findNearestSnap(
  currentHeight: number,
  containerHeight: number,
): SnapState {
  const collapsed = PEEK_HEIGHT;
  const half = containerHeight * HALF_RATIO;
  const full = containerHeight * FULL_RATIO;

  const dCollapsed = Math.abs(currentHeight - collapsed);
  const dHalf = Math.abs(currentHeight - half);
  const dFull = Math.abs(currentHeight - full);

  if (dCollapsed <= dHalf && dCollapsed <= dFull) return 'collapsed';
  if (dHalf <= dFull) return 'half';
  return 'full';
}

export default function BottomSheet({ children }: BottomSheetProps) {
  const [snap, setSnap] = useState<SnapState>('half');
  const [isDragging, setIsDragging] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const getContainerHeight = useCallback(() => {
    return containerRef.current?.parentElement?.clientHeight ?? window.innerHeight;
  }, []);

  const currentHeight =
    isDragging && dragHeight !== null
      ? dragHeight
      : getSnapHeight(snap, getContainerHeight());

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      startYRef.current = e.clientY;
      startHeightRef.current = getSnapHeight(snap, getContainerHeight());
      setIsDragging(true);
    },
    [snap, getContainerHeight],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const deltaY = startYRef.current - e.clientY;
      const containerHeight = getContainerHeight();
      const newHeight = Math.max(
        PEEK_HEIGHT,
        Math.min(containerHeight * FULL_RATIO, startHeightRef.current + deltaY),
      );
      setDragHeight(newHeight);
    },
    [isDragging, getContainerHeight],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    const containerHeight = getContainerHeight();
    const finalHeight = dragHeight ?? getSnapHeight(snap, containerHeight);
    const nearest = findNearestSnap(finalHeight, containerHeight);
    setSnap(nearest);
    setIsDragging(false);
    setDragHeight(null);
  }, [isDragging, dragHeight, snap, getContainerHeight]);

  const cycleSnap = useCallback(() => {
    setSnap((prev) => {
      if (prev === 'collapsed') return 'half';
      if (prev === 'half') return 'full';
      return 'collapsed';
    });
  }, []);

  const handleHandleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      cycleSnap();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSnap((prev) => (prev === 'collapsed' ? 'half' : 'full'));
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSnap((prev) => (prev === 'full' ? 'half' : 'collapsed'));
    }
  }, [cycleSnap]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl bg-white shadow-lg"
      style={{
        height: currentHeight,
        transition: isDragging ? 'none' : 'height 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Drag handle */}
      <button
        type="button"
        aria-label="Adjust bottom sheet height"
        className="flex w-full shrink-0 cursor-grab items-center justify-center py-3 active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleHandleKeyDown}
      >
        <div className="h-1 w-10 rounded-full bg-stone-400" />
      </button>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {children}
      </div>
    </div>
  );
}
