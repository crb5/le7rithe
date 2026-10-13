import { useEffect, useState } from 'react';

export type ScrollDirection = 'up' | 'down' | null;

export type ScrollDirectionState = {
  direction: ScrollDirection;
  isAtTop: boolean;
};

const MOVEMENT_THRESHOLD_PX = 8;
const TOP_THRESHOLD_PX = 10;

export function useScrollDirection(resetKey?: string | number): ScrollDirectionState {
  const [state, setState] = useState<ScrollDirectionState>(() => ({
    direction: null,
    isAtTop: typeof window === 'undefined' || window.scrollY < TOP_THRESHOLD_PX,
  }));

  useEffect(() => {
    let previousY = Math.max(0, window.scrollY);
    let latestY = previousY;
    let animationFrame: number | null = null;

    setState({ direction: null, isAtTop: previousY < TOP_THRESHOLD_PX });

    const updateScrollState = () => {
      animationFrame = null;
      const currentY = latestY;
      const difference = currentY - previousY;
      let nextDirection: ScrollDirection = null;

      if (Math.abs(difference) >= MOVEMENT_THRESHOLD_PX) {
        previousY = currentY;
        nextDirection = difference > 0 ? 'down' : 'up';
      }

      const isAtTop = currentY < TOP_THRESHOLD_PX;
      setState((current) => {
        const direction = nextDirection ?? current.direction;
        if (direction === current.direction && isAtTop === current.isAtTop) return current;
        return { direction, isAtTop };
      });
    };

    const handleScroll = () => {
      latestY = Math.max(0, window.scrollY);
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(updateScrollState);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [resetKey]);

  return state;
}