import { useEffect, useRef, useState } from "react";

/**
 * Tracks how close an element is to the viewport, so cards can defer loading
 * their asset and stop playing or animating once they scroll away.
 *
 * Views the app isn't showing stay mounted behind `display: none` (see App.tsx),
 * and an element with no box never intersects — so every card of a hidden board
 * reports as off screen, which is exactly the behaviour we want.
 *
 * `near` leads `visible` by a margin so an asset is ready by the time it is
 * scrolled into view; `visible` is the strict answer to "can it be seen right
 * now", and is what gates anything that costs CPU frame after frame.
 */
export function useNearViewport(margin = "300px") {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const nearby = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: margin },
    );
    const onScreen = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    nearby.observe(el);
    onScreen.observe(el);

    return () => {
      nearby.disconnect();
      onScreen.disconnect();
    };
  }, [margin]);

  return { ref, near, visible };
}
