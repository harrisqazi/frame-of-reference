import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const Logo3D = dynamic(() => import("@/components/Logo3D"), { ssr: false });

const SENSE_PHRASES = [
  "the vision",
  "the taste",
  "the feeling",
  "the smell",
  "the sound",
];

const SCRIPT = [
  { action: "type", text: "Remember that dream you held.", delay: 40 },
  { action: "wait", ms: 900 },
  { action: "flash", text: "VISUALIZE IT", ms: 1100 },
  { action: "type", text: "\n\nBring it back for a moment", delay: 40 },
  { action: "dots", count: 3, interval: 900 },
  { action: "wait", ms: 800 },
  {
    action: "type",
    text: "\n\nImagine seeing it through with all 5 senses:\n\n",
    delay: 40,
  },
  {
    action: "cycle",
    phrases: SENSE_PHRASES,
    typeDelay: 40,
    holdMs: 800,
    vanishMs: 900,
  },
  { action: "wait", ms: 500 },
  { action: "type", text: "\n\nNow take it to the source.", delay: 50 },
];

const TerminalSimulator = ({ step, setStep }) => {
  const [typedText, setTypedText] = useState("");
  const [countdownLabel, setCountdownLabel] = useState("");
  const [buttonVisible, setButtonVisible] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [flashOverlay, setFlashOverlay] = useState(null);
  const [senseWord, setSenseWord] = useState("");
  const [senseVanishing, setSenseVanishing] = useState(false);

  const [scrollPosition, setScrollPosition] = useState(0);
  const [images, setImages] = useState([]);
  const [viewportHeight, setViewportHeight] = useState(800);
  const displayIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const rafRef = useRef(null);
  const hasAdvancedRef = useRef(false);
  const scriptRunIdRef = useRef(0);

  const imgRef = useRef();

  const totalImages = 1200;
  const sampledImages = Math.floor(totalImages / 4);
  const scrollAmountPerImage = 20;
  const stepSize = Math.floor(totalImages / sampledImages);
  const maxFramesPerSecond = 5;
  const maxFrameIndex = sampledImages - 1;
  const scrollSpacerHeight =
    maxFrameIndex * scrollAmountPerImage + viewportHeight;

  useEffect(() => {
    const updateViewport = () => setViewportHeight(window.innerHeight);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    import("@/components/Logo3D");
    const initialDelayId = setTimeout(() => setScriptReady(true), 800);
    return () => clearTimeout(initialDelayId);
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
          const base = content;
          for (let d = 1; d <= segment.count; d++) {
            if (cancelled || scriptRunIdRef.current !== runId) return;
            setContent(base + ".".repeat(d));
            await wait(segment.interval);
          }
          content = base + ".".repeat(segment.count);
        } else if (segment.action === "cycle") {
          setCountdownLabel("");
          for (let p = 0; p < segment.phrases.length; p++) {
            if (!live()) return;
            const phrase = segment.phrases[p];
            setSenseVanishing(false);
            for (let c = 1; c <= phrase.length; c++) {
              if (!live()) return;
              setSenseWord(phrase.slice(0, c));
              await wait(segment.typeDelay);
            }
            if (p < segment.phrases.length - 1) {
              await wait(segment.holdMs);
              if (!live()) return;
              setSenseVanishing(true);
              await wait(segment.vanishMs);
              if (!live()) return;
              setSenseWord("");
              setSenseVanishing(false);
            }
          }
          if (!live()) return;
          setSenseWord("");
          setContent(content + segment.phrases[segment.phrases.length - 1]);
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

  useEffect(() => {
    const loadedImages = [];
    for (let i = 0; i <= totalImages; i += stepSize) {
      const paddedIndex = String(i).padStart(4, "0");
      const imagePath = `/animation_3/640x360/AB_${paddedIndex}.png`;
      loadedImages.push(imagePath);
      const img = new Image();
      img.src = imagePath;
    }
    setImages(loadedImages);
  }, [stepSize]);

  const getScrollTop = () =>
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0;

  const getTargetIndex = useCallback(() => {
    const index = Math.ceil(getScrollTop() / scrollAmountPerImage);
    return Math.min(maxFrameIndex, Math.max(0, index));
  }, [maxFrameIndex, scrollAmountPerImage]);

  const preloadAround = useCallback(
    (index) => {
      if (!images.length) return;
      for (let offset = 0; offset <= 12; offset++) {
        const target = index + offset;
        if (target < images.length) {
          const img = new Image();
          img.src = images[target];
        }
      }
    },
    [images]
  );

  const advanceToNextStep = useCallback(() => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    setStep(1);
    window.scrollTo(0, 0);
  }, [setStep]);

  useEffect(() => {
    if (!images.length) return;

    const tick = (timestamp) => {
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
      const elapsed = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      const targetIndex = getTargetIndex();
      const maxAdvance = Math.max(
        1,
        Math.floor((elapsed / 1000) * maxFramesPerSecond)
      );

      if (targetIndex > displayIndexRef.current) {
        displayIndexRef.current = Math.min(
          targetIndex,
          displayIndexRef.current + maxAdvance
        );
      } else if (targetIndex < displayIndexRef.current) {
        displayIndexRef.current = Math.max(
          targetIndex,
          displayIndexRef.current - maxAdvance
        );
      }

      setScrollPosition(displayIndexRef.current);
      preloadAround(displayIndexRef.current);

      if (displayIndexRef.current >= maxFrameIndex) {
        advanceToNextStep();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [images, preloadAround, getTargetIndex, maxFrameIndex, advanceToNextStep]);

  useEffect(() => {
    if (imgRef.current && images[scrollPosition]) {
      imgRef.current.src = images[scrollPosition];
    }
  }, [scrollPosition, images]);

  const opacity = 1 - scrollPosition / Math.max(maxFrameIndex, 1);

  const renderText = () => {
    const lines = typedText.split("\n");
    return lines.map((item, key) => {
      const isLast = key === lines.length - 1;
      return (
        <span key={key}>
          {item}
          {isLast &&
            senseWord.split("").map((ch, i) => (
              <span
                key={`${senseWord.length}-${i}`}
                className={senseVanishing ? "vanish-char" : undefined}
                style={
                  senseVanishing
                    ? { animationDelay: `${(senseWord.length - 1 - i) * 45}ms` }
                    : undefined
                }
              >
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))}
          {isLast && !countdownLabel && <span className="matrix-cursor" />}
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
            style={{ opacity }}
            className="fixed h-screen w-full p-12 flex justify-center"
          >
            <div className="text-white text-left w-[400px] pt-8 max-w-11/12 font-mono">
              <p>
                {renderText()}
                {countdownLabel && (
                  <span className="block mt-6 text-2xl text-white/90">
                    {countdownLabel}
                  </span>
                )}
              </p>
              <Logo3D variant="hero" className="intro-logo" />
            </div>

            <div className="absolute phone:bottom-24 bottom-12 w-full flex justify-center pointer-events-auto">
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
