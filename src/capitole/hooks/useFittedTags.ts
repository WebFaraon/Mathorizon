import { useLayoutEffect, useRef, useState } from 'react';

const MAX_TAGS = 3;

/**
 * How many subcategory tags fit on ONE row of a chapter card.
 *
 * Ported from js/app.js's fitCardTags(), and for the same reason: the tag
 * names are Romanian subcategory names of very different widths ("Limite"
 * vs "Matrici Inversabile"), so a fixed count of 3 wraps onto a second row
 * on some cards and not others, and every card in the grid then has a
 * different height. Measuring real layout (offsetTop) beats guessing a
 * character budget — diacritics and kerning make width estimates
 * unreliable, and this stays correct if a subcategory is ever renamed.
 *
 * Unlike the original it also re-fits on resize, so the cards stay on one
 * row through the grid's 4 → 3 → 2 → 1 column breakpoints instead of only
 * being correct at whatever width the page happened to load at.
 *
 * @returns [ref for the tag container, how many names to render]
 */
export function useFittedTags(total: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const ceiling = Math.min(MAX_TAGS, total);
  const [shown, setShown] = useState(ceiling);

  // Shrinks by one per pass; React re-renders and this runs again, so it
  // converges on the largest count that stays on a single row (min 1).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || shown <= 1) return;
    const tags = Array.from(el.children) as HTMLElement[];
    if (tags.length < 2) return;
    const firstTop = tags[0].offsetTop;
    if (tags.some((tag) => tag.offsetTop !== firstTop)) setShown(shown - 1);
  }, [shown]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    // Only a WIDTH change may restart the fit. Dropping a tag changes this
    // container's height, which would otherwise re-trigger the observer,
    // reset the count to the ceiling, and loop forever.
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      setShown(ceiling);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ceiling]);

  return [ref, shown];
}
