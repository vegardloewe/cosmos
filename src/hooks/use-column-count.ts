import { useState, useEffect } from "react";

function getColumnCount(width: number): number {
  if (width >= 1280) return 5;
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  if (width >= 640) return 2;
  return 1;
}

export function useColumnCount(): number {
  const [count, setCount] = useState(() => getColumnCount(window.innerWidth));

  useEffect(() => {
    const onResize = () => setCount(getColumnCount(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return count;
}
