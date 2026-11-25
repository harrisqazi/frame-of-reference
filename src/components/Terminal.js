import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const Logo3D = dynamic(() => import("@/components/Logo3D"), { ssr: false });

const CENTER_MARK = "\u0002";
const LOWER_MARK = "\u0003";

const FRAME_COUNT = 301;
const SCROLL_PER_FRAME = 20;
const FADE_OUT_INDEX = 60;
const AUTOPLAY_FRAME_MS = 28;
const GESTURES_TO_AUTOPLAY = 2;
const GESTURE_GAP_MS = 350;
const frameUrl = (i) =>
  `/animation_3/640x360-webp/AB_${String(i * 4).padStart(4, "0")}.webp`;

const SCRIPT = [
  { action: "type", text: "Where have you been?", delay: 55 },
  { action: "wait", ms: 1400 },
  { action: "type", text: `\n\n${LOWER_MARK}Where will you go?`, delay: 55 },
  { action: "logo" },
  { action: "wait", ms: 900 },
  {
    action: "type",
    text: `\n\n${CENTER_MARK}Now take a moment and bridge the gap.`,
    delay: 50,
  },
];

const TerminalSimulator = ({ step, setStep }) => {
  const [typedText, setTypedText] = useState("");
  const [buttonVisible, setButtonVisible] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);

  const [viewportHeight, setViewportHeight] = useState(800);
  const displayIndexRef = useRef(-1);
  const rafRef = useRef(null);
  const hasAdvancedRef = useRef(false);
  const preloadedRef = useRef(new Map());
  const loadedRef = useRef(new Set());
  const shownFrameRef = useRef(-1);
  const logoReadyRef = useRef(null);
  const autoplayRef = useRef(false);
  const autoStartRef = useRef(null);
  const logoPausedRef = useRef(false);
  const [logoPaused, setLogoPaused] = useState(false);

  const imgRef = useRef();
  const textLayerRef = useRef();

  const maxFrameIndex = FRAME_COUNT - 1;
  const scrollSpacerHeight =
    maxFrameIndex * SCROLL_PER_FRAME + viewportHeight;

  useEffect(() => {
    const updateViewport = () => setViewportHeight(window.innerHeight);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  // Hold the script until fonts, the first frame and the (hidden) logo are
  // ready, so nothing heavy competes with the typing cadence.
  useEffect(() => {
    let done = false;
    const start = () => {
      if (!done) {
        done = true;
        setScriptReady(true);
      }
    };
    const firstFrame = new Image();
    firstFrame.src = frameUrl(0);
    Promise.all([
      document.fonts?.ready,
      firstFrame.decode().catch(() => {}),
      new Promise((resolve) => {
        logoReadyRef.current = resolve;
      }),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]).then(start);
    const cap = setTimeout(start, 4000);
    return () => clearTimeout(cap);
  }, []);

  useEffect(() => {
    if (!scriptReady) return;
    let cancelled = false;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const runScript = async () => {
      let content = "";
      for (const segment of SCRIPT) {
        if (cancelled) return;
        if (segment.action === "type") {
          for (const ch of segment.text) {
            if (cancelled) return;
            content += ch;
            setTypedText(content);
            await wait(segment.delay);
          }
        } else if (segment.action === "wait") {
          await wait(segment.ms);
        } else if (segment.action === "logo") {
          setLogoVisible(true);
        }
      }
      if (!cancelled) setButtonVisible(true);
    };

    runScript();
    return () => {
      cancelled = true;
    };
  }, [scriptReady]);

  const preloadAround = useCallback((index) => {
    for (let offset = -4; offset <= 30; offset++) {
      const target = index + offset;
      if (target < 0 || target > FRAME_COUNT - 1) continue;
      if (preloadedRef.current.has(target)) continue;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => loadedRef.current.add(target);
      img.src = frameUrl(target);
      preloadedRef.current.set(target, img);
    }
  }, []);

  useEffect(() => {
    if (!scriptReady) return;
    let next = 0;
    let timer;
    const pump = () => {
      preloadAround(next);
      next += 30;
      if (next < FRAME_COUNT) timer = setTimeout(pump, 400);
    };
    timer = setTimeout(pump, 1500);
    return () => clearTimeout(timer);
  }, [scriptReady, preloadAround]);

  const advanceToNextStep = useCallback(() => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    setStep(1);
    window.scrollTo(0, 0);
  }, [setStep]);

  const startAutoplay = useCallback(() => {
    autoplayRef.current = true;
  }, []);

  // After a couple of separate scroll gestures, the sequence plays itself
  // through to the end at a steady pace.
  useEffect(() => {
    let gestures = 0;
    let lastInput = 0;
    const gesture = () => {
      const now = performance.now();
      if (now - lastInput > GESTURE_GAP_MS) {
        gestures += 1;
        if (gestures >= GESTURES_TO_AUTOPLAY) startAutoplay();
      }
      lastInput = now;
    };
    const onWheel = (e) => {
      if (e.deltaY > 0) gesture();
    };
    let touchY = null;
    const onTouchStart = (e) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e) => {
      const endY = e.changedTouches[0]?.clientY;
      if (touchY != null && endY != null && touchY - endY > 20) {
        lastInput = 0;
        gesture();
      }
      touchY = null;
    };
    const onKey = (e) => {
      if (["ArrowDown", "PageDown", " ", "Spacebar"].includes(e.key)) {
        lastInput = 0;
        gesture();
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [startAutoplay]);

  // Frames and the text fade are written straight to the DOM, so scrolling
  // never re-renders React and can't disturb the typing.
  useEffect(() => {
    const show = (index) => {
      displayIndexRef.current = index;
      if (
        imgRef.current &&
        (index === 0 || loadedRef.current.has(index)) &&
        shownFrameRef.current !== index
      ) {
        shownFrameRef.current = index;
        imgRef.current.src = frameUrl(index);
      }
      if (textLayerRef.current) {
        textLayerRef.current.style.opacity = String(
          Math.max(0, 1 - index / FADE_OUT_INDEX)
        );
      }
      const hidden = index >= FADE_OUT_INDEX;
      if (hidden !== logoPausedRef.current) {
        logoPausedRef.current = hidden;
        setLogoPaused(hidden);
      }
      preloadAround(index);
      if (index >= maxFrameIndex) advanceToNextStep();
    };

    const tick = (now) => {
      const current = displayIndexRef.current;
      if (autoplayRef.current) {
        if (!autoStartRef.current) {
          autoStartRef.current = { t: now, index: Math.max(current, 0) };
        }
        const { t, index } = autoStartRef.current;
        const desired = Math.min(
          maxFrameIndex,
          index + Math.floor((now - t) / AUTOPLAY_FRAME_MS)
        );
        let next = desired;
        while (next > current && !loadedRef.current.has(next)) next -= 1;
        if (next > current) show(next);
      } else {
        const target = Math.min(
          maxFrameIndex,
          Math.max(0, Math.ceil(window.scrollY / SCROLL_PER_FRAME))
        );
        if (target !== current) {
          const diff = target - current;
          show(
            current < 0
              ? target
              : current +
                  Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) / 4))
          );
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    preloadAround(0);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [preloadAround, maxFrameIndex, advanceToNextStep]);

  const renderText = () => {
    const lines = typedText.split("\n");
    return lines.map((item, key) => {
      const isLast = key === lines.length - 1;
      const cursor = isLast && <span className="matrix-cursor" />;

      if (item.startsWith(LOWER_MARK)) {
        return (
          <span key={key} className="block mt-[6vh]">
            {item.slice(1)}
            {cursor}
          </span>
        );
      }

      if (item.startsWith(CENTER_MARK)) {
        return (
          <span key={key} className="block text-center mt-[12vh]">
            {item.slice(1)}
            {cursor}
          </span>
        );
      }

      return (
        <span key={key}>
          {item}
          {cursor}
          <br />
        </span>
      );
    });
  };

  return (
    <>
      {step === 0 && (
        <>
          <div style={{ height: `${scrollSpacerHeight}px` }} />
          <div className="fixed w-screen h-screen z-20 text-white overflow-hidden">
            <img
              ref={imgRef}
              alt=""
              className="object-cover object-center w-full h-full"
            />
          </div>
          <div
            ref={textLayerRef}
            className="fixed h-screen w-full p-12 flex justify-center"
          >
            <div className="intro-copy relative z-10 text-white text-left w-[400px] pt-8 max-w-11/12 font-mono">
              <p className="bg-transparent">{renderText()}</p>
            </div>
            <Logo3D
              variant="hero"
              className={`intro-logo ${logoVisible ? "is-visible" : ""}`}
              paused={logoPaused}
              onReady={() => logoReadyRef.current?.()}
            />

            <div className="absolute z-10 phone:bottom-24 bottom-12 w-full flex justify-center pointer-events-auto">
              <button
                type="button"
                onClick={startAutoplay}
                className={`mt-4 p-4 border-white border-2 font-mono transition-opacity duration-1000 bg-transparent text-white hover:bg-white/10 ${
                  buttonVisible
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                Scroll to Proceed
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default TerminalSimulator;
