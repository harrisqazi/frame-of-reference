import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { BRANCH_QUESTIONS } from "@/data/manifestationQuestions";

const Logo3D = dynamic(() => import("@/components/Logo3D"), {
  ssr: false,
  loading: () => (
    <div className="manifestation-logo-fallback manifestation-logo-fallback--loading" />
  ),
});

const CYCLING_IDEAS = [
  "Recycling infrastructure in Guadalajara",
  "Pacific Islander Venture Fund",
  "A new app or software tool to help people manage their finances",
  "A design for a new product, such as a piece of furniture or a piece of jewelry",
  "A new social media platform that connects people with similar interests",
  "A service that helps people with home organization and decluttering",
  "An API that allows businesses to integrate with a popular third-party tool",
  "A solution for reducing plastic waste in the environment",
  "A local solution for improving transportation in a specific city or town",
  "A global solution for addressing climate change.",
  "A mobile app that helps people track their water intake throughout the day",
  "A recipe for a vegan and gluten-free chocolate cake that doesn't sacrifice taste",
  "A proposal for a startup that provides affordable, healthy meal delivery to college campuses",
  "A design for a new ergonomic office chair that improves posture and reduces back pain",
  "A social media platform that focuses on connecting pet owners with each other and with pet-friendly businesses",
  "A service that helps busy parents organize their family schedules and tasks",
  "An API that allows businesses to access real-time data on weather patterns and climate conditions in their area",
  "A solution for turning plastic waste into eco-friendly building materials",
  "A local solution for improving bike infrastructure in a specific neighborhood or district",
  "A global solution for reducing food waste by optimizing supply chains and reducing spoilage during transportation.",
];

const CATEGORIES = [
  { key: "Product", label: "Product" },
  { key: "Service", label: "Service" },
  { key: "API", label: "API" },
  { key: "Invention", label: "Invention" },
  { key: "Solution", label: "Solution" },
  { key: "other", label: "Something else" },
];

const IDEA_QUESTION = "What do you want to create?";
const CATEGORY_QUESTION =
  "Is this a product, a service, an API, an invention, a solution—or something else?";

function useTypewriter(text, active, speed = 28) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active || !text) {
      setOut("");
      return;
    }
    let i = 0;
    setOut("");
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return out;
}

function categoryLabel(key) {
  return CATEGORIES.find((c) => c.key === key)?.label || key || "";
}

export default function TypeformFlow({ setStep }) {
  const [phase, setPhase] = useState("intro");
  const [introTitleDone, setIntroTitleDone] = useState(false);
  const [ideaCarouselText, setIdeaCarouselText] = useState("");
  const [ideaIndex, setIdeaIndex] = useState(0);
  const [ideaDeleting, setIdeaDeleting] = useState(false);
  const [ideaWaiting, setIdeaWaiting] = useState(false);

  const [flowStep, setFlowStep] = useState(0);
  const [history, setHistory] = useState([]);
  const [idea, setIdea] = useState("");
  const [category, setCategory] = useState(null);

  const [branchTyped, setBranchTyped] = useState("");
  const [branchTypingDone, setBranchTypingDone] = useState(true);
  const [branchInput, setBranchInput] = useState("");
  const [branchInputVisible, setBranchInputVisible] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sendSplash, setSendSplash] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const activeRef = useRef(null);
  const branchInputRef = useRef(null);

  const titleTyped = useTypewriter(IDEA_QUESTION, phase === "intro", 32);

  const branchQuestions = useMemo(
    () => (category && BRANCH_QUESTIONS[category] ? BRANCH_QUESTIONS[category] : []),
    [category]
  );

  const branchOffset = 2;
  const branchIndex = flowStep - branchOffset;
  const activeBranchQuestion =
    branchIndex >= 0 ? branchQuestions[branchIndex] || "" : "";

  const showCornerLogo = phase === "draw" && !sendSplash;

  useEffect(() => {
    if (phase !== "intro") return;
    if (titleTyped.length < IDEA_QUESTION.length) return;
    const t = setTimeout(() => setIntroTitleDone(true), 400);
    return () => clearTimeout(t);
  }, [phase, titleTyped]);

  useEffect(() => {
    if (!introTitleDone || phase !== "intro") return;
    const currentIdea = ideaIndex % CYCLING_IDEAS.length;
    const fullText = CYCLING_IDEAS[currentIdea];
    if (ideaWaiting) return;

    const typeDelay = ideaDeleting ? 8 : 20;
    const pauseAfterType = 650;

    const timerId = setTimeout(() => {
      if (!ideaDeleting && ideaCarouselText === fullText) {
        setIdeaWaiting(true);
        setTimeout(() => {
          setIdeaWaiting(false);
          setIdeaDeleting(true);
        }, pauseAfterType);
      } else if (ideaDeleting && ideaCarouselText === "") {
        setIdeaDeleting(false);
        setIdeaIndex((prev) => (prev + 1) % CYCLING_IDEAS.length);
      } else {
        setIdeaCarouselText((prev) =>
          ideaDeleting ? prev.slice(0, -1) : prev + fullText[prev.length]
        );
      }
    }, typeDelay);

    return () => clearTimeout(timerId);
  }, [
    introTitleDone,
    phase,
    ideaCarouselText,
    ideaDeleting,
    ideaWaiting,
    ideaIndex,
  ]);

  useEffect(() => {
    if (phase !== "flow" || flowStep < branchOffset || !activeBranchQuestion) {
      return;
    }
    setBranchTyped("");
    setBranchTypingDone(false);
    setBranchInput("");
    setBranchInputVisible(false);

    let i = 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      if (i >= activeBranchQuestion.length) {
        setBranchTypingDone(true);
        setBranchTyped("");
        setTimeout(() => setBranchInputVisible(true), 200);
        return;
      }
      i += 1;
      setBranchTyped(activeBranchQuestion.slice(0, i));
      setTimeout(step, 26);
    };
    const t = setTimeout(step, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [phase, flowStep, activeBranchQuestion, branchOffset]);

  useEffect(() => {
    if (branchInputVisible && branchInputRef.current) {
      branchInputRef.current.focus();
    }
  }, [branchInputVisible, flowStep]);

  useEffect(() => {
    setPortalReady(true);
    import("@/components/Logo3D");
  }, []);

  useEffect(() => {
    if (phase === "draw") import("@/components/Logo3D");
  }, [phase]);

  useEffect(() => {
    if (!["flow", "draw"].includes(phase)) return;
    const t = setTimeout(() => {
      activeRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
    return () => clearTimeout(t);
  }, [phase, flowStep, branchInputVisible, branchTypingDone, history.length]);

  const updateHistoryAnswer = (index, value) => {
    setHistory((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], answer: value };
      return next;
    });
    if (index === 0) setIdea(value);
    if (index === 1) {
      const cat = CATEGORIES.find((c) => c.label === value)?.key;
      if (cat) setCategory(cat);
    }
  };

  const proceedIdea = () => {
    setHistory([{ question: IDEA_QUESTION, answer: idea.trim() }]);
    setFlowStep(1);
  };

  const proceedCategory = (key) => {
    setCategory(key);
    setHistory((prev) => [
      ...prev.slice(0, 1),
      { question: CATEGORY_QUESTION, answer: categoryLabel(key) },
    ]);
    setFlowStep(branchOffset);
  };

  const proceedBranch = (answerText) => {
    setHistory((prev) => [
      ...prev,
      { question: activeBranchQuestion, answer: answerText },
    ]);
    setBranchInput("");
    if (branchIndex + 1 >= branchQuestions.length) {
      setPhase("draw");
      return;
    }
    setFlowStep((s) => s + 1);
  };

  const getCanvasContext = () => canvasRef.current?.getContext("2d") || null;

  const drawSegment = (x0, y0, x1, y1) => {
    const ctx = getCanvasContext();
    if (!ctx) return;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  const canvasCoords = (e) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
  };

  useEffect(() => {
    if (phase !== "draw") return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, [phase]);

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  };

  const submitAll = (drawingMode = "canvas") => {
    if (submitting) return;

    let drawingPayload = null;
    if (drawingMode === "canvas" && canvasRef.current) {
      try {
        drawingPayload = canvasRef.current.toDataURL("image/png");
      } catch (err) {
        console.warn("Could not export sketch:", err);
      }
    }

    const branchAnswers = history
      .slice(branchOffset)
      .map((item) => item.answer);

    const payload = {
      idea: (history[0]?.answer || idea).trim(),
      category:
        category === "other"
          ? "Something else"
          : categoryLabel(category) || history[1]?.answer || "",
      branchQuestions,
      branchAnswers,
      drawingDataUrl: drawingPayload,
    };

    setSubmitting(true);
    setSendSplash(true);

    fetch("/api/manifestation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.emailed && !data.sheet) {
          console.warn("Email not sent — see EMAIL_SETUP.md", data);
        }
      })
      .catch((err) => console.error("manifestation submit failed:", err));

    setTimeout(() => {
      setSubmitting(false);
      setSendSplash(false);
      setStep(7);
    }, 4200);
  };

  const renderHistory = () =>
    history.map((item, i) => (
      <li key={`hist-${i}`} className="pb-6 mb-6 border-b border-gray-300 list-none">
        <p className="mb-1 text-xs text-gray-500">Question {i + 1}</p>
        <p className="mb-2 font-medium text-gray-900">{item.question}</p>
        <label className="block text-xs text-gray-500 mb-1">Your answer</label>
        <textarea
          value={item.answer}
          onChange={(e) => updateHistoryAnswer(i, e.target.value)}
          rows={i === 0 ? 4 : 3}
          className="w-full resize-none bg-white border border-gray-200 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-gray-800 relative z-20"
        />
      </li>
    ));

  return (
    <>
      {showCornerLogo && (
        <Logo3D variant="corner" className="manifestation-logo-corner" />
      )}

      {portalReady &&
        sendSplash &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] manifestation-send-overlay manifestation-send-overlay--active pointer-events-none"
            aria-live="polite"
            aria-label="Sending your manifestation"
          >
            <div className="manifestation-logo-stage">
              <Logo3D sending className="manifestation-logo-send" />
              <p className="manifestation-send-caption">
                Sending your manifestation…
              </p>
            </div>
          </div>,
          document.body
        )}

      <div className="relative z-20 max-w-[420px] w-11/12 text-black pt-8 pb-24 font-mono mx-auto">
        {phase === "intro" && (
          <div className="relative z-20">
            <p className="min-h-[3.5rem]">
              {titleTyped}
              {titleTyped.length < IDEA_QUESTION.length && (
                <span className="text-cyan-600 ml-0.5">_</span>
              )}
            </p>
            {introTitleDone && (
              <div className="mt-4 text-sm text-gray-500 min-h-[5rem]">
                <span>{ideaCarouselText}</span>
                <span className="text-cyan-600 ml-1">_</span>
              </div>
            )}
            {introTitleDone && (
              <button
                type="button"
                onClick={() => {
                  setFlowStep(0);
                  setHistory([]);
                  setPhase("flow");
                }}
                className="mt-8 px-4 py-3 border-2 border-gray-800 w-full hover:bg-gray-100 relative z-20"
              >
                Continue
              </button>
            )}
          </div>
        )}

        {(phase === "flow" || phase === "draw") && (
          <div className="relative z-20">
            {history.length > 0 && (
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-4">
                Your answers — scroll up anytime to edit
              </p>
            )}
            <ol className="space-y-0 list-none m-0 p-0">{renderHistory()}</ol>

            {phase === "flow" && flowStep === 0 && (
              <li ref={activeRef} className="scroll-mt-8 pb-6 list-none">
                <p className="mb-1 text-xs text-cyan-700">Question 1</p>
                <p className="mb-2 font-medium text-gray-900">{IDEA_QUESTION}</p>
                <label className="block text-sm text-gray-500 mb-2">
                  Type what you want to create
                </label>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="i want to create "
                  rows={5}
                  className="w-full resize-none bg-white border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-gray-900 relative z-20"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIdea("I'll share more later");
                    proceedIdea();
                  }}
                  className="mt-3 text-sm text-gray-500 underline hover:text-gray-800 relative z-20"
                >
                  Skip — I&apos;ll describe later
                </button>
                <button
                  type="button"
                  onClick={proceedIdea}
                  className="mt-4 px-4 py-3 border-2 border-gray-800 w-full hover:bg-gray-100 relative z-20"
                >
                  Next
                </button>
              </li>
            )}

            {phase === "flow" && flowStep === 1 && (
              <li ref={activeRef} className="scroll-mt-8 pb-6 list-none">
                <p className="mb-1 text-xs text-cyan-700">Question 2</p>
                <p className="mb-4 font-medium text-gray-900">{CATEGORY_QUESTION}</p>
                <div className="flex flex-col gap-2 relative z-20">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => proceedCategory(c.key)}
                      className="text-left px-4 py-3 border-2 border-gray-300 hover:border-gray-800 hover:bg-gray-50 bg-white"
                    >
                      {c.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => proceedCategory("other")}
                    className="text-center px-4 py-2 text-sm text-gray-500 underline hover:text-gray-800"
                  >
                    Skip — not sure how to categorize
                  </button>
                </div>
              </li>
            )}

            {phase === "flow" && flowStep >= branchOffset && (
              <li ref={activeRef} className="scroll-mt-8 pb-6 list-none">
                <p className="mb-1 text-xs text-cyan-700">
                  Question {flowStep + 1}
                </p>
                {!branchTypingDone ? (
                  <p className="mb-2 font-medium text-gray-900">
                    {branchTyped}
                    <span className="text-cyan-600 ml-0.5">_</span>
                  </p>
                ) : (
                  <p className="mb-2 font-medium text-gray-900">
                    {activeBranchQuestion}
                  </p>
                )}
                {branchInputVisible && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start mt-2 relative z-20">
                    <textarea
                      ref={branchInputRef}
                      value={branchInput}
                      onChange={(e) => setBranchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (branchInput.trim()) proceedBranch(branchInput.trim());
                        }
                      }}
                      rows={3}
                      className="flex-1 w-full resize-none bg-white border border-gray-200 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                    />
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!branchInput.trim()}
                        onClick={() => proceedBranch(branchInput.trim())}
                        className="px-3 py-2 border-2 border-gray-800 disabled:opacity-40 bg-white"
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        onClick={() => proceedBranch("")}
                        className="px-3 py-2 border border-gray-400 text-gray-600 text-sm hover:bg-gray-50 bg-white"
                      >
                        Skip question
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )}

            {phase === "draw" && (
              <li ref={activeRef} className="scroll-mt-8 pb-6 list-none relative z-20">
                <p className="mb-1 text-xs text-cyan-700">Sketch your idea</p>
                <p className="mb-2">
                  Want to sketch your idea? Use the pad below—or skip.
                </p>
                <canvas
                  ref={canvasRef}
                  width={360}
                  height={220}
                  className="w-full max-w-md border-2 border-gray-300 touch-none cursor-crosshair bg-white"
                  onMouseDown={(e) => {
                    drawingRef.current = true;
                    const { x, y } = canvasCoords(e);
                    lastPointRef.current = { x, y };
                  }}
                  onMouseMove={(e) => {
                    if (!drawingRef.current || !lastPointRef.current) return;
                    const { x, y } = canvasCoords(e);
                    const { x: x0, y: y0 } = lastPointRef.current;
                    drawSegment(x0, y0, x, y);
                    lastPointRef.current = { x, y };
                  }}
                  onMouseUp={() => {
                    drawingRef.current = false;
                    lastPointRef.current = null;
                  }}
                  onMouseLeave={() => {
                    drawingRef.current = false;
                    lastPointRef.current = null;
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    const t = e.touches[0];
                    drawingRef.current = true;
                    lastPointRef.current = canvasCoords({
                      clientX: t.clientX,
                      clientY: t.clientY,
                    });
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    if (!drawingRef.current || !lastPointRef.current) return;
                    const t = e.touches[0];
                    const { x, y } = canvasCoords({
                      clientX: t.clientX,
                      clientY: t.clientY,
                    });
                    const { x: x0, y: y0 } = lastPointRef.current;
                    drawSegment(x0, y0, x, y);
                    lastPointRef.current = { x, y };
                  }}
                  onTouchEnd={() => {
                    drawingRef.current = false;
                    lastPointRef.current = null;
                  }}
                />
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="px-4 py-2 border-2 border-gray-400 bg-white"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => submitAll("skip")}
                    disabled={submitting}
                    className="px-4 py-2 border-2 border-gray-800 bg-white"
                  >
                    Skip drawing &amp; send
                  </button>
                  <button
                    type="button"
                    onClick={() => submitAll("canvas")}
                    disabled={submitting}
                    className="px-4 py-2 border-2 border-black bg-gray-900 text-white"
                  >
                    Send manifestation
                  </button>
                </div>
              </li>
            )}
          </div>
        )}
      </div>
    </>
  );
}
