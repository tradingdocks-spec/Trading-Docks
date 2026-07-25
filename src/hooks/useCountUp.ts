"use client";

import { useEffect, useState } from "react";

export function useCountUp(target: number, duration = 1050) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    function update(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(update);
      }
    }

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
