import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { BRANCH_QUESTIONS } from "@/data/manifestationQuestions";

const Logo3D = dynamic(() => import("@/components/Logo3D"), { ssr: false });

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

export default function TypeformFlow({ setStep }) {
  const [phase, setPhase] = useState("intro");
  const [introTitleDone, setIntroTitleDone] = useState(false);
  const [ideaCarouselText, setIdeaCarouselText] = useState("");
  const [ideaIndex, setIdeaIndex] = useState(0);
  const [ideaDeleting, setIdeaDeleting] = useState(false);
  const [ideaWaiting, setIdeaWaiting] = useState(false);

  const [idea, setIdea] = useState("");
  const [category, setCategory] = useState(null);

  const [qaIndex, setQaIndex] = useState(0);
  const [branchAnswers, setBranchAnswers] = useState([]);
  const [qaHistory, setQaHistory] = useState([]);
  const [qaTyped, setQaTyped] = useState("");
  const [qaTypingDone, setQaTypingDone] = useState(false);
  const [qaInput, setQaInput] = useState("");
  const [qaInputVisible, setQaInputVisible] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sendSplash, setSendSplash] = useState(false);

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const qaInputRef = useRef(null);
  const qaActiveRef = useRef(null);

  const titleText = "What do you want to create?";
  const titleTyped = useTypewriter(titleText, phase === "intro", 32);

  const categoryQuestion =
    "Is this a product, a service, an API, an invention, a solution—or something else?";
  const categoryTyped = useTypewriter(
    categoryQuestion,
    phase === "category",
    26
  );

  const currentBranchQuestions =
    category && BRANCH_QUESTIONS[category]
      ? BRANCH_QUESTIONS[category]
      : [];
  const activeQuestion =
    currentBranchQuestions[qaIndex] || "";

  useEffect(() => {
    if (phase !== "intro") return;
    if (titleTyped.length < titleText.length) return;
    const t = setTimeout(() => setIntroTitleDone(true), 400);
    return () => clearTimeout(t);
  }, [phase, titleTyped, titleText.length]);

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
    if (phase !== "qa" || !activeQuestion) return;
    setQaTyped("");
    setQaTypingDone(false);
    setQaInput("");
    setQaInputVisible(false);

    let i = 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      if (i >= activeQuestion.length) {
        setQaTypingDone(true);
        setQaTyped("");
        setTimeout(() => setQaInputVisible(true), 200);
        return;
      }
      i += 1;
      setQaTyped(activeQuestion.slice(0, i));
      setTimeout(step, 26);
    };
    const t = setTimeout(step, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [phase, qaIndex, activeQuestion]);

  useEffect(() => {
    if (qaInputVisible && qaInputRef.current) qaInputRef.current.focus();
  }, [qaInputVisible, qaIndex]);

  useEffect(() => {
    if (phase === "draw") {
      import("@/components/Logo3D");
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "qa") return;
    const t = setTimeout(() => {
      qaActiveRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 80);
    return () => clearTimeout(t);
  }, [phase, qaIndex, qaInputVisible, qaTypingDone, qaHistory.length]);

  const proceedCategory = (key) => {
    setCategory(key);
    setQaIndex(0);
    setBranchAnswers([]);
    setQaHistory([]);
    setPhase("qa");
  };

  const updateHistoryAnswer = (index, value) => {
    setQaHistory((history) => {
      const next = [...history];
      next[index] = { ...next[index], answer: value };
      return next;
    });
    setBranchAnswers((answers) => {
      const next = [...answers];
      next[index] = value;
      return next;
    });
  };

  const skipQa = () => {
    const nextHistory = [
      ...qaHistory,
      { question: activeQuestion, answer: "" },
    ];
    setQaHistory(nextHistory);
    setBranchAnswers(nextHistory.map((t) => t.answer));
    setQaInput("");
    if (qaIndex + 1 >= currentBranchQuestions.length) {
      setPhase("draw");
      return;
    }
    setQaIndex((i) => i + 1);
  };

  const proceedQa = () => {
    const nextHistory = [
      ...qaHistory,
      { question: activeQuestion, answer: qaInput.trim() },
    ];
    setQaHistory(nextHistory);
    setBranchAnswers(nextHistory.map((t) => t.answer));
    setQaInput("");
    if (qaIndex + 1 >= currentBranchQuestions.length) {
      setPhase("draw");
      return;
    }
    setQaIndex((i) => i + 1);
  };

  const getCanvasContext = () => {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext("2d");
  };

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
    const x = (e.clientX - r.left) * (c.width / r.width);
    const y = (e.clientY - r.top) * (c.height / r.height);
    return { x, y };
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

    const answers =
      qaHistory.length > 0
        ? qaHistory.map((t) => t.answer)
        : branchAnswers;

    const payload = {
      idea: idea.trim(),
      category: category === "other" ? "Something else" : category || "",
      branchQuestions: currentBranchQuestions,
      branchAnswers: answers,
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
          console.warn(
            "Email not sent — add SMTP_USER + SMTP_PASS (Gmail app password) in Vercel. See EMAIL_SETUP.md",
            data
          );
        }
      })
      .catch((err) => console.error("manifestation submit failed:", err));

    setTimeout(() => {
      setSubmitting(false);
      setSendSplash(false);
      setStep(7);
    }, 4200);
  };

  return (
    <>
      {sendSplash && (
        <div className="fixed inset-0 z-[60] manifestation-send-overlay pointer-events-none">
          <Logo3D sending className="manifestation-logo-send pointer-events-none" />
        </div>
      )}

      <div className="relative z-10 max-w-[420px] w-11/12 text-black pt-6 pb-24 font-mono mx-auto bg-gray-100/95 backdrop-blur-sm">

      {phase === "intro" && (
        <div>
          <p className="min-h-[3.5rem]">
            {titleTyped}
            {titleTyped.length < titleText.length && (
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
              onClick={() => setPhase("create")}
              className="mt-8 px-4 py-3 border-2 border-gray-800 w-full hover:bg-gray-100"
            >
              Continue
            </button>
          )}
        </div>
      )}

      {phase === "create" && (
        <div>
          <p className="mb-4 text-gray-600">{titleText}</p>
          <label className="block text-sm text-gray-500 mb-2">
            Type what you want to create
          </label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="i want to create "
            rows={5}
            className="w-full resize-none bg-gray-100 border-0 p-3 focus:outline-none focus:ring-2 focus:ring-cyan-600 placeholder:text-gray-400 placeholder:italic text-gray-900"
          />
          <button
            type="button"
            onClick={() => {
              setIdea("I'll share more later");
              setPhase("category");
            }}
            className="mt-3 text-sm text-gray-500 underline hover:text-gray-800"
          >
            Skip — I&apos;ll describe later
          </button>
          <button
            type="button"
            disabled={idea.trim().length < 2}
            onClick={() => setPhase("category")}
            className="mt-6 px-4 py-3 border-2 border-gray-800 w-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            Next
          </button>
        </div>
      )}

      {phase === "category" && (
        <div>
          <p className="min-h-[6rem]">
            {categoryTyped}
            {categoryTyped.length < categoryQuestion.length && (
              <span className="text-cyan-600 ml-0.5">_</span>
            )}
          </p>
          {categoryTyped.length >= categoryQuestion.length && (
            <div className="mt-6 flex flex-col gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => proceedCategory(c.key)}
                  className="text-left px-4 py-3 border-2 border-gray-300 hover:border-gray-800 hover:bg-gray-50"
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
          )}
        </div>
      )}

      {phase === "qa" && (
        <div className="pb-12 space-y-8">
          {currentBranchQuestions.map((question, i) => {
            if (i > qaIndex) return null;
            const isActive = i === qaIndex;
            const turn = qaHistory[i];

            if (!isActive && turn) {
              return (
                <div
                  key={`qa-done-${i}`}
                  className="pb-6 border-b border-gray-300"
                >
                  <p className="mb-2 font-medium text-gray-900">{turn.question}</p>
                  <label className="block text-xs text-gray-500 mb-1">
                    Your answer
                  </label>
                  <textarea
                    value={turn.answer}
                    onChange={(e) => updateHistoryAnswer(i, e.target.value)}
                    rows={3}
                    className="w-full resize-none bg-white border border-gray-200 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-gray-800"
                  />
                </div>
              );
            }

            if (!isActive) return null;

            return (
              <div
                key={`qa-active-${i}`}
                ref={qaActiveRef}
                className="scroll-mt-8 pb-4"
              >
                {!qaTypingDone ? (
                  <p className="mb-2 font-medium text-gray-900">
                    {qaTyped}
                    <span className="text-cyan-600 ml-0.5">_</span>
                  </p>
                ) : (
                  <p className="mb-2 font-medium text-gray-900">{question}</p>
                )}
                {qaInputVisible && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start w-full mt-2">
                    <textarea
                      ref={qaInputRef}
                      value={qaInput}
                      onChange={(e) => setQaInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (qaInput.trim()) proceedQa();
                        }
                      }}
                      rows={3}
                      className="flex-1 w-full resize-none bg-white border border-gray-200 p-2 focus:outline-none focus:ring-2 focus:ring-cyan-600 caret-cyan-600"
                    />
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!qaInput.trim()}
                        onClick={proceedQa}
                        className="px-3 py-2 border-2 border-gray-800 disabled:opacity-40"
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        onClick={skipQa}
                        className="px-3 py-2 border border-gray-400 text-gray-600 text-sm hover:bg-gray-50"
                      >
                        Skip question
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {phase === "draw" && (
        <div className="relative z-20">
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
              const { x, y } = canvasCoords({
                clientX: t.clientX,
                clientY: t.clientY,
              });
              lastPointRef.current = { x, y };
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
              className="px-4 py-2 border-2 border-gray-400"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => submitAll("skip")}
              disabled={submitting}
              className="px-4 py-2 border-2 border-gray-800"
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
        </div>
      )}
      </div>
    </>
  );
}
