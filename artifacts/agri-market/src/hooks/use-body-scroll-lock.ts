import { useLayoutEffect, type RefObject } from 'react';

type InlineStyleValue = {
  property: string;
  value: string;
  priority: string;
};

type LockSnapshot = {
  htmlStyles: InlineStyleValue[];
  bodyStyles: InlineStyleValue[];
  scrollX: number;
  scrollY: number;
};

const readInlineStyles = (style: CSSStyleDeclaration, properties: string[]): InlineStyleValue[] =>
  properties.map((property) => ({
    property,
    value: style.getPropertyValue(property),
    priority: style.getPropertyPriority(property),
  }));

const restoreInlineStyles = (style: CSSStyleDeclaration, values: InlineStyleValue[]) => {
  for (const { property, value, priority } of values) {
    if (value) style.setProperty(property, value, priority);
    else style.removeProperty(property);
  }
};

const activeLocks = new Map<symbol, HTMLElement | null>();
const rootClassOwners = new Map<HTMLElement, { count: number; alreadyPresent: boolean }>();
let snapshot: LockSnapshot | null = null;
let removeGlobalListeners: (() => void) | null = null;
let touchStart: { x: number; y: number; allowed: boolean } | null = null;

const getAllowedRoot = (path: EventTarget[]) => {
  for (const target of path) {
    if (!(target instanceof HTMLElement)) continue;
    if (target.hasAttribute('data-body-scroll-lock-allow')) return target;

    for (const root of activeLocks.values()) {
      if (root && (root === target || root.contains(target))) return root;
    }
  }
  return null;
};

const canScrollInDirection = (
  element: HTMLElement,
  axis: 'x' | 'y',
  fingerDelta: number,
) => {
  const style = window.getComputedStyle(element);
  const overflow = axis === 'y' ? style.overflowY : style.overflowX;
  if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'overlay') return false;

  if (axis === 'y') {
    const maximum = element.scrollHeight - element.clientHeight;
    if (maximum <= 1) return false;
    return fingerDelta < 0 ? element.scrollTop < maximum - 1 : element.scrollTop > 1;
  }

  const maximum = element.scrollWidth - element.clientWidth;
  if (maximum <= 1) return false;
  return fingerDelta < 0 ? element.scrollLeft < maximum - 1 : element.scrollLeft > 1;
};

const canScrollPath = (path: EventTarget[], axis: 'x' | 'y', fingerDelta: number) => {
  for (const target of path) {
    if (!(target instanceof HTMLElement)) continue;
    if (target === document.body || target === document.documentElement) continue;
    if (canScrollInDirection(target, axis, fingerDelta)) return true;
  }
  return false;
};

const updateVisualViewportHeight = () => {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--body-lock-visual-viewport-height', `${height}px`);
};

const preventBackgroundTouchScroll = (event: TouchEvent) => {
  if (!event.cancelable || !touchStart || event.touches.length !== 1) return;

  const path = event.composedPath();
  const root = getAllowedRoot(path);
  if (!touchStart.allowed || !root) {
    event.preventDefault();
    return;
  }

  const touch = event.touches[0];
  const deltaX = touch.clientX - touchStart.x;
  const deltaY = touch.clientY - touchStart.y;
  if (Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) return;

  // Horizontal gestures do not move the locked page and are used by carousels.
  if (Math.abs(deltaX) > Math.abs(deltaY)) return;

  if (!canScrollPath(path, 'y', deltaY)) event.preventDefault();
};

const beginTouch = (event: TouchEvent) => {
  if (event.touches.length !== 1) {
    touchStart = null;
    return;
  }

  const path = event.composedPath();
  touchStart = {
    x: event.touches[0].clientX,
    y: event.touches[0].clientY,
    allowed: getAllowedRoot(path) !== null,
  };
};

const resetTouch = () => {
  touchStart = null;
};

const installBodyLock = () => {
  const html = document.documentElement;
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
  const bodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

  snapshot = {
    htmlStyles: readInlineStyles(html.style, [
      'overflow',
      'overscroll-behavior',
      'scroll-behavior',
      '--body-lock-visual-viewport-height',
    ]),
    bodyStyles: readInlineStyles(body.style, [
      'position',
      'top',
      'left',
      'right',
      'width',
      'overflow',
      'padding-right',
    ]),
    scrollX,
    scrollY,
  };

  html.style.setProperty('overflow', 'hidden');
  html.style.setProperty('overscroll-behavior', 'none');
  body.style.setProperty('position', 'fixed');
  body.style.setProperty('top', `${-scrollY}px`);
  body.style.setProperty('left', `${-scrollX}px`);
  body.style.setProperty('right', 'auto');
  body.style.setProperty('width', '100%');
  body.style.setProperty('overflow', 'hidden');
  if (scrollbarWidth > 0) {
    body.style.setProperty('padding-right', `${bodyPaddingRight + scrollbarWidth}px`);
  }
  updateVisualViewportHeight();

  document.addEventListener('touchstart', beginTouch, { capture: true, passive: true });
  document.addEventListener('touchmove', preventBackgroundTouchScroll, { capture: true, passive: false });
  document.addEventListener('touchend', resetTouch, true);
  document.addEventListener('touchcancel', resetTouch, true);

  const visualViewport = window.visualViewport;
  visualViewport?.addEventListener('resize', updateVisualViewportHeight);
  removeGlobalListeners = () => {
    document.removeEventListener('touchstart', beginTouch, true);
    document.removeEventListener('touchmove', preventBackgroundTouchScroll, true);
    document.removeEventListener('touchend', resetTouch, true);
    document.removeEventListener('touchcancel', resetTouch, true);
    visualViewport?.removeEventListener('resize', updateVisualViewportHeight);
  };
};

const restoreBodyLock = () => {
  if (!snapshot) return;

  removeGlobalListeners?.();
  removeGlobalListeners = null;

  const { htmlStyles, bodyStyles, scrollX, scrollY } = snapshot;
  snapshot = null;
  const body = document.body;
  const html = document.documentElement;

  restoreInlineStyles(body.style, bodyStyles);
  restoreInlineStyles(
    html.style,
    htmlStyles.filter(({ property }) => property !== 'scroll-behavior'),
  );
  html.style.setProperty('scroll-behavior', 'auto');
  window.scrollTo(scrollX, scrollY);
  restoreInlineStyles(
    html.style,
    htmlStyles.filter(({ property }) => property === 'scroll-behavior'),
  );
};

const acquireBodyScrollLock = (root: HTMLElement | null) => {
  const lockId = Symbol('body-scroll-lock');
  if (activeLocks.size === 0) installBodyLock();
  activeLocks.set(lockId, root);

  if (root) {
    const owner = rootClassOwners.get(root);
    if (owner) owner.count += 1;
    else {
      rootClassOwners.set(root, {
        count: 1,
        alreadyPresent: root.classList.contains('body-scroll-lock-root'),
      });
      root.classList.add('body-scroll-lock-root');
    }
  }

  return () => {
    activeLocks.delete(lockId);

    if (root) {
      const owner = rootClassOwners.get(root);
      if (owner && owner.count <= 1) {
        if (!owner.alreadyPresent) root.classList.remove('body-scroll-lock-root');
        rootClassOwners.delete(root);
      } else if (owner) {
        owner.count -= 1;
      }
    }

    if (activeLocks.size === 0) restoreBodyLock();
  };
};

export function useBodyScrollLock<T extends HTMLElement>(
  locked: boolean,
  scrollableRef: RefObject<T | null>,
  rootSelector?: string,
) {
  useLayoutEffect(() => {
    if (!locked) return;

    const root = scrollableRef.current
      ?? (rootSelector ? document.querySelector<HTMLElement>(rootSelector) : null);
    return acquireBodyScrollLock(root);
  }, [locked, rootSelector, scrollableRef]);
}
