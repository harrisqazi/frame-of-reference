import React, { useState, useEffect, useRef, useCallback } from "react";

const SCRIPT = [
  { action: "type", text: "Remember that dream you had", delay: 36 },
  { action: "countdown", steps: [1, 2, 3], interval: 1000 },
  {
    action: "type",
    text: "\n\nThe one you let go for something more realistic",
    delay: 36,
  },
  { action: "wait", ms: 3000 },
  { action: "type", text: "\n\nBring it back for a moment.", delay: 36 },
  { action: "wait", ms: 2000 },
  { action: "type", text: "\n\nHold onto it with all 5 senses:\n\n", delay: 36 },
  {
    action: "type",
    text: "the feeling of having accomplished that dream, the smell after having created it, the taste of gratitude on your tongue, the sound of the dream being realized",
    delay: 22,
  },
  { action: "dots", count: 4, interval: 1000 },
  { action: "wait", ms: 800 },
  { action: "type", text: "\n\nNow take it to the source.", delay: 55 },
];

const TerminalSimulator = ({ step, setStep }) => {
  const [typedText, setTypedText] = useState("");
  const [countdownLabel, setCountdownLabel] = useState("");
  const [buttonVisible, setButtonVisible] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

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
  const maxIndexAdvancePerSecond = 60;
  const maxFrameIndex = sampledImages - 1;
  const scrollSpacerHeight =
    maxFrameIndex * scrollAmountPerImage + viewportHeight + 200;

  useEffect(() => {
    document.documentElement.style.overflowY = "auto";
    document.body.style.overflowY = "auto";
    return () => {
      document.documentElement.style.overflowY = "";
      document.body.style.overflowY = "";
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => setViewportHeight(window.innerHeight);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
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

  const getMaxScrollTop = useCallback(
    () => Math.max(0, scrollSpacerHeight - viewportHeight),
    [scrollSpacerHeight, viewportHeight]
  );

  const getTargetIndex = useCallback(() => {
    const maxScroll = getMaxScrollTop();
    if (maxScroll <= 0) return 0;
    const progress = Math.min(1, getScrollTop() / maxScroll);
    return Math.min(maxFrameIndex, Math.round(progress * maxFrameIndex));
  }, [getMaxScrollTop, maxFrameIndex]);

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
        Math.floor((elapsed / 1000) * maxIndexAdvancePerSecond)
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

      const maxScroll = getMaxScrollTop();
      const scrollTop = getScrollTop();
      const scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;

      if (scrollProgress >= 0.88 || targetIndex >= maxFrameIndex - 1) {
        displayIndexRef.current = maxFrameIndex;
        advanceToNextStep();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    images,
    preloadAround,
    getTargetIndex,
    getMaxScrollTop,
    maxFrameIndex,
    advanceToNextStep,
  ]);

  useEffect(() => {
    if (imgRef.current && images[scrollPosition]) {
      imgRef.current.src = images[scrollPosition];
    }
  }, [scrollPosition, images]);

  const opacity = 1 - scrollPosition / Math.max(maxFrameIndex, 1);

  const renderText = () => {
    const lines = typedText.split("\n");
    return lines.map((item, key) => (
      <span key={key}>
        {item}
        {key === lines.length - 1 && !countdownLabel && (
          <span className="text-cyan-500 ml-1">_</span>
        )}
        <br />
      </span>
    ));
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
            style={{ opacity }}
            className="fixed h-screen w-full p-12 flex justify-center pointer-events-none"
          >
            <div className="text-white w-[400px] pt-8 max-w-11/12 font-mono">
              <p>
                {renderText()}
                {countdownLabel && (
                  <span className="block mt-6 text-2xl text-white/90">
                    {countdownLabel}
                  </span>
                )}
              </p>
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

