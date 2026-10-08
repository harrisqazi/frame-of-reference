import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const Logo3D = dynamic(() => import("@/components/Logo3D"), { ssr: false });

const SENSE_PHRASES = [
  "the vision",
  "the taste",
  "the touch",
  "the smell",
  "the sound",
];

// Marks a typed line that should sit on the right side of its row.
const SENSE_MARK = "\u0001";
const CENTER_MARK = "\u0002";
const SENSE_SLOT_CH = Math.max(...SENSE_PHRASES.map((p) => p.length)) + 1;

const FRAME_COUNT = 301;
const SCROLL_PER_FRAME = 20;
const FADE_OUT_INDEX = 60;
const frameUrl = (i) =>
  `/animation_3/640x360-webp/AB_${String(i * 4).padStart(4, "0")}.webp`;

const SCRIPT = [
  { action: "type", text: "Remember that dream you held.", delay: 40 },
  { action: "wait", ms: 900 },
  { action: "flash", text: "VISUALIZE IT", ms: 1100 },
  { action: "type", text: "\n\nBring it back for a moment", delay: 40 },
  { action: "dots", count: 3, interval: 600 },
  {
    action: "type",
    text: "\n\nImagine seeing it through with all 5 senses:\n\n",
    delay: 40,
  },
  {
    action: "cycle",
    phrases: SENSE_PHRASES,
    beat: 480,
  },
  { action: "wait", ms: 500 },
  {
    action: "type",
    text: `\n\n${CENTER_MARK}Now take it to the source.`,
    delay: 50,
  },
];

const TerminalSimulator = ({ step, setStep }) => {
  const [typedText, setTypedText] = useState("");
  const [countdownLabel, setCountdownLabel] = useState("");
  const [buttonVisible, setButtonVisible] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [flashOverlay, setFlashOverlay] = useState(null);
  const [senseWord, setSenseWord] = useState("");
  const [senseAppearing, setSenseAppearing] = useState(false);
  const [senseVanishing, setSenseVanishing] = useState(false);
  const [senseActive, setSenseActive] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);

  const [viewportHeight, setViewportHeight] = useState(800);
  const displayIndexRef = useRef(-1);
  const rafRef = useRef(null);
  const hasAdvancedRef = useRef(false);
  const scriptRunIdRef = useRef(0);
  const preloadedRef = useRef(new Map());
  const loadedRef = useRef(new Set());
  const shownFrameRef = useRef(-1);
  const logoReadyRef = useRef(null);

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

    const runId = ++scriptRunIdRef.current;
    let cancelled = false;

    const wait = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    const runScript = async () => {
      let content = "";

      const setContent = (next) => {
        content = next;
        if (!cancelled && scriptRunIdRef.current === runId) {
          setTypedText(content);
        }
      };

      const typeChars = async (text, delay) => {
        for (let i = 0; i < text.length; i++) {
          if (cancelled || scriptRunIdRef.current !== runId) return;
          content += text[i];
          setContent(content);
          await wait(delay);
        }
      };

      const live = () => !cancelled && scriptRunIdRef.current === runId;

      for (const segment of SCRIPT) {
        if (cancelled || scriptRunIdRef.current !== runId) return;

        if (segment.action === "type") {
          setCountdownLabel("");
          await typeChars(segment.text, segment.delay);
        } else if (segment.action === "countdown") {
          for (const n of segment.steps) {
            if (cancelled || scriptRunIdRef.current !== runId) return;
            setCountdownLabel(String(n));
            await wait(segment.interval);
          }
          setCountdownLabel("");
        } else if (segment.action === "wait") {
          setCountdownLabel("");
          await wait(segment.ms);
        } else if (segment.action === "dots") {
          setCountdownLabel("");
          // Scheduled against a fixed start time so main-thread jank
          // can't push later dots off the beat.
          const base = content;
          const start = performance.now();
          for (let d = 1; d <= segment.count; d++) {
            await wait(start + d * segment.interval - performance.now());
            if (!live()) return;
            setContent(base + ".".repeat(d));
          }
          await wait(start + (segment.count + 1) * segment.interval - performance.now());
          setLogoVisible(true);
          await wait(segment.interval);
        } else if (segment.action === "cycle") {
          setCountdownLabel("");
          setSenseActive(true);
          // Each phrase spans three beats: appear, hold, vanish.
          const start = performance.now();
          const atBeat = (n) => wait(start + n * segment.beat - performance.now());
          for (let p = 0; p < segment.phrases.length; p++) {
            if (!live()) return;
            setSenseVanishing(false);
            setSenseAppearing(true);
            setSenseWord(segment.phrases[p]);
            await atBeat(p * 3 + 1);
            if (!live()) return;
            setSenseAppearing(false);
            if (p === segment.phrases.length - 1) break;
            await atBeat(p * 3 + 2);
            if (!live()) return;
            setSenseVanishing(true);
            await atBeat(p * 3 + 3);
            if (!live()) return;
            setSenseWord("");
          }
          if (!live()) return;
          setSenseWord("");
          setSenseActive(false);
          setContent(
            content + SENSE_MARK + segment.phrases[segment.phrases.length - 1]
          );
        } else if (segment.action === "flash") {
          setCountdownLabel("");
          if (!cancelled && scriptRunIdRef.current === runId) {
            setFlashOverlay(segment.text);
          }
          await wait(segment.ms);
          if (!cancelled && scriptRunIdRef.current === runId) {
            setFlashOverlay(null);
          }
        }
      }

      if (!cancelled && scriptRunIdRef.current === runId) {
        setButtonVisible(true);
      }
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

  // Scrolling drives the frame and fade directly on the DOM, so it never
  // re-renders React and can't disturb the typing.
  useEffect(() => {
    const tick = () => {
      const target = Math.min(
        maxFrameIndex,
        Math.max(0, Math.ceil(window.scrollY / SCROLL_PER_FRAME))
      );
      const current = displayIndexRef.current;
      if (target !== current) {
        const next =
          current < 0 ? target : current + Math.sign(target - current) * Math.max(1, Math.ceil(Math.abs(target - current) / 4));
        displayIndexRef.current = next;
        if (
          imgRef.current &&
          (next === 0 || loadedRef.current.has(next)) &&
          shownFrameRef.current !== next
        ) {
          shownFrameRef.current = next;
          imgRef.current.src = frameUrl(next);
        }
        if (textLayerRef.current) {
          textLayerRef.current.style.opacity = String(
            Math.max(0, 1 - next / FADE_OUT_INDEX)
          );
        }
        preloadAround(next);
        if (next >= maxFrameIndex) advanceToNextStep();
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
      const cycling = isLast && senseActive;
      const cursor = isLast && !countdownLabel && (
        <span className="matrix-cursor" />
      );

      if (cycling || item.startsWith(SENSE_MARK)) {
        const chars = cycling ? senseWord : item.slice(1);
        // Fixed-width, left-aligned slot on the right of the row, so letters
        // never shift while they appear or vanish.
        return (
          <span key={key} className="block text-right text-xl opacity-70">
            <span
              className="inline-block text-left"
              style={{ width: `${SENSE_SLOT_CH}ch` }}
            >
              {chars.split("").map((ch, i) => (
                <span
                  key={`${chars}-${i}`}
                  className={
                    !cycling
                      ? undefined
                      : senseAppearing
                      ? "vanish-char vanish-char--in"
                      : senseVanishing
                      ? "vanish-char"
                      : undefined
                  }
                  style={
                    !cycling
                      ? undefined
                      : senseAppearing
                      ? { animationDelay: `${i * 20}ms` }
                      : senseVanishing
                      ? { animationDelay: `${(chars.length - 1 - i) * 25}ms` }
                      : undefined
                  }
                >
                  {ch === " " ? "\u00a0" : ch}
                </span>
              ))}
              {cursor}
            </span>
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
      {flashOverlay && (
        <div className="fixed inset-0 z-[60] bg-white flex items-center justify-center">
          <p className="text-black font-mono text-3xl sm:text-5xl tracking-[0.35em] uppercase">
            {flashOverlay}
          </p>
        </div>
      )}
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
              <p className="bg-transparent">
                {renderText()}
                {countdownLabel && (
                  <span className="block mt-6 text-2xl text-white/90">
                    {countdownLabel}
                  </span>
                )}
              </p>
            </div>
            <Logo3D
              variant="hero"
              className={`intro-logo ${logoVisible ? "is-visible" : ""}`}
              onReady={() => logoReadyRef.current?.()}
            />

            <div className="absolute z-10 phone:bottom-24 bottom-12 w-full flex justify-center pointer-events-auto">
              <button
                type="button"
                onClick={advanceToNextStep}
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
