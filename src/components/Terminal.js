import React, { useState, useEffect, useRef, useCallback } from "react";

const introductionText = `Hello,

Its time to focus on what you want. Whatever you want.

Take a moment and imagine it with all 5 senses.

The sounds around you, the feeling at your fingertips, the smell in the air, the taste in your mouth, the sight of the room surrounding you.

Now take it to the source.`;

const SENSORY_START = introductionText.indexOf(
  "The sounds around you"
);
const SENSORY_END = introductionText.indexOf("Now take it to the source.");

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
  const displayIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const rafRef = useRef(null);

  const imgRef = useRef();

  const totalImages = 1200;
  const sampledImages = Math.floor(totalImages / 4);
  const scrollAmountPerImage = 20;
  const stepSize = Math.floor(totalImages / sampledImages);
  const maxIndexAdvancePerSecond = 14;
  const scrollSpacerHeight = sampledImages * scrollAmountPerImage;

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

  const preloadAround = useCallback(
    (index) => {
      if (!images.length) return;
      const lookahead = 8;
      for (let offset = 0; offset <= lookahead; offset++) {
        const target = index + offset;
        if (target < images.length) {
          const img = new Image();
          img.src = images[target];
        }
      }
    },
    [images]
  );

  useEffect(() => {
    if (!images.length) return;

    const tick = (timestamp) => {
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
      const elapsed = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      const targetIndex = Math.min(
        sampledImages - 1,
        Math.max(0, Math.ceil(window.pageYOffset / scrollAmountPerImage))
      );

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

      if (displayIndexRef.current === sampledImages - 1) {
        setStep(1);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [images, preloadAround, sampledImages, scrollAmountPerImage, setStep]);

  useEffect(() => {
    if (imgRef.current && images[scrollPosition]) {
      imgRef.current.src = images[scrollPosition];
    }
  }, [scrollPosition, images]);

  const opacity = 1 - scrollPosition / Math.max(sampledImages - 1, 1);

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
            <div className="bg-black text-white w-[400px] pt-8 max-w-11/12 font-mono">
              <p>{renderText}</p>
            </div>

            <div className="absolute phone:bottom-24 bottom-12 flex justify-center">
              <div
                className={`mt-4 p-4 border-white border-2 font-mono transition-opacity duration-1000 ${
                  buttonVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                Scroll to Proceed
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default TerminalSimulator;
