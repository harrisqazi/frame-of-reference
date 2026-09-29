import React, { useEffect, useRef, useState } from "react";

const INSET = 9;
const SPEED = 38;

export default function PerimeterTicker({ items = [] }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [text, setText] = useState("");
  const measureRef = useRef(null);
  const aRef = useRef(null);
  const bRef = useRef(null);
  const lenRef = useRef(1);

  useEffect(() => {
    const update = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const el = measureRef.current;
    if (!el || !items.length || !size.w) return;
    const perimeter = 2 * (size.w + size.h);
    const unit = items.join("   ◆   ") + "   ◆   ";
    let s = unit;
    el.textContent = s;
    let guard = 0;
    while (el.getComputedTextLength() < perimeter && guard++ < 200) {
      s += unit;
      el.textContent = s;
    }
    lenRef.current = el.getComputedTextLength() || 1;
    setText(s);
  }, [items, size]);

  useEffect(() => {
    if (!text) return;
    let raf;
    let offset = 0;
    let last = performance.now();
    const tick = (now) => {
      offset = (offset + ((now - last) / 1000) * SPEED) % lenRef.current;
      last = now;
      aRef.current?.setAttribute("startOffset", offset);
      bRef.current?.setAttribute("startOffset", offset - lenRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  if (!items.length || !size.w) return null;

  const { w, h } = size;
  const path = `M ${INSET} ${INSET} V ${h - INSET} H ${w - INSET} V ${INSET} Z`;

  return (
    <svg
      className="perimeter-ticker"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <defs>
        <path id="perimeter-path" d={path} />
      </defs>
      <text ref={measureRef} style={{ visibility: "hidden" }} />
      <text dominantBaseline="middle">
        <textPath ref={aRef} href="#perimeter-path">
          {text}
        </textPath>
      </text>
      <text dominantBaseline="middle">
        <textPath ref={bRef} href="#perimeter-path">
          {text}
        </textPath>
      </text>
    </svg>
  );
}
