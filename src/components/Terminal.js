import React, { useState, useEffect, useRef, useCallback } from "react";

const introductionText = `Remember that idea that you had,

The one you let go for something more realistic.

Bring it back for a moment.

Hold onto it with all 5 senses. The feeling of having accomplished that dream, the smell after having created it, the taste of gratitude on your tongue, the sound of the dream being realized...

Now take it to the source  `;

const SENSORY_START = introductionText.indexOf(
  "The feeling of having accomplished"
);
const SENSORY_END = introductionText.indexOf("Now take it to the source");

const getCharDelay = (index) => {
  if (index >= SENSORY_START && index < SENSORY_END) return 48;
  return 32;
};

const TerminalSimulator = ({ step, setStep }) => {
  const [typedText, setTypedText] = useState("");
  const [buttonVisible, setButtonVisible] = useState(false);
  const [delayComplete, setDelayComplete] = useState(false);

  const [scrollPosition, setScrollPosition] = useState(0);
  const [images, setImages] = useState([]);
  const [viewportHeight, setViewportHeight] = useState(800);
  const displayIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const rafRef = useRef(null);
  const hasAdvancedRef = useRef(false);

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
    const initialDelayId = setTimeout(() => setDelayComplete(true), 1000);
    return () => clearTimeout(initialDelayId);
  }, []);

  useEffect(() => {
    if (!delayComplete) return;

    if (typedText === introductionText) {
      setButtonVisible(true);
      return;
    }

    const nextIndex = typedText.length;
    const timerId = setTimeout(() => {
      setTypedText(introductionText.slice(0, nextIndex + 1));
    }, getCharDelay(nextIndex));

    return () => clearTimeout(timerId);
  }, [delayComplete, typedText]);

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

  const renderText = typedText.split("\n").map((item, key) => (
    <span key={key}>
      {item}
      {key === typedText.split("\n").length - 1 && (
        <span className="text-cyan-500 ml-1">_</span>
      )}
      <br />
    </span>
  ));

  return (
    <>
      {step === 0 && (
        <>
          <div style={{ height: `${scrollSpacerHeight}px` }} />
          <div className="fixed inset-0 z-20 pointer-events-none text-white overflow-hidden">
            <img
              ref={imgRef}
              alt=""
              className="object-cover object-center w-full h-full"
            />
          </div>
          <div
            style={{ opacity }}
            className="fixed inset-0 z-30 pointer-events-none p-12 flex justify-center"
          >
            <div className="bg-black text-white w-[400px] pt-8 max-w-11/12 font-mono pointer-events-none">
              <p>{renderText}</p>
            </div>

            <div className="absolute phone:bottom-24 bottom-12 left-0 right-0 flex justify-center">
              <button
                type="button"
                onClick={advanceToNextStep}
                className={`mt-4 p-4 border-white border-2 font-mono transition-opacity duration-1000 pointer-events-auto bg-transparent text-white hover:bg-white/10 ${
                  buttonVisible ? "opacity-100" : "opacity-0"
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


