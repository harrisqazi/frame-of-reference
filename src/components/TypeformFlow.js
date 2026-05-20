import React, { useEffect, useState, useRef } from "react";
import { BRANCH_QUESTIONS } from "@/data/manifestationQuestions";

const EXAMPLE_IDEAS = [
  "a neighborhood tool-swap that cuts waste",
  "a calm app for first-time founders",
  "a local transit idea you shelved last year",
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
  const [exampleIdx, setExampleIdx] = useState(0);

  const [idea, setIdea] = useState("");
  const [category, setCategory] = useState(null);

  const [qaIndex, setQaIndex] = useState(0);
  const [branchAnswers, setBranchAnswers] = useState([]);
  const [qaMessages, setQaMessages] = useState([]);
  const [qaTyped, setQaTyped] = useState("");
  const [qaTypingDone, setQaTypingDone] = useState(false);
  const [qaInput, setQaInput] = useState("");
  const [qaInputVisible, setQaInputVisible] = useState(false);

  const [drawingDataUrl, setDrawingDataUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [overlay, setOverlay] = useState(false);

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const qaInputRef = useRef(null);

  const titleText = "What do you want to create?";
  const titleTyped = useTypewriter(titleText, phase === "intro", 32);

  const categoryQuestion =
    "Is this a product, a service, an API, an invention, a solution—or something else?";
  const categoryTyped = useTypewriter(
    categoryQuestion,
    phase === "category",
    26
  );

  const currentBranchQuestions = category
    ? BRANCH_QUESTIONS[category] || []
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
    const id = setInterval(() => {
      setExampleIdx((i) => (i + 1) % EXAMPLE_IDEAS.length);
    }, 420);
    return () => clearInterval(id);
  }, [introTitleDone, phase]);

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
        setQaMessages((m) => [...m, { text: activeQuestion, user: false }]);
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

  const proceedCategory = (key) => {
    setCategory(key);
    if (key === "other") {
      setPhase("draw");
      return;
    }
    setQaIndex(0);
    setBranchAnswers([]);
    setQaMessages([]);
    setPhase("qa");
  };

  const proceedQa = () => {
    const nextAnswers = [...branchAnswers, qaInput.trim()];
    setBranchAnswers(nextAnswers);
    setQaMessages((m) => [...m, { text: qaInput.trim(), user: true }]);
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
    setDrawingDataUrl(null);
  };

  const finalizeDrawing = () => {
    const c = canvasRef.current;
    if (c) setDrawingDataUrl(c.toDataURL("image/png"));
  };

  const submitAll = async () => {
    setSubmitting(true);
    setOverlay(true);
    const payload = {
      idea: idea.trim(),
      category: category || "",
      branchAnswers,
      drawingDataUrl,
    };
    try {
      await fetch("/api/manifestation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
    setTimeout(() => setStep(7), 2800);
  };

  return (
    <div className="max-w-[420px] w-11/12 text-black pt-6 pb-24 font-mono min-h-screen">
      <div
        className={`fixed inset-0 bg-black z-50 transition-opacity duration-[2800] pointer-events-none ${
      overlay ? "opacity-100" : "opacity-0"
    }`}
      />

      {phase === "intro" && (
        <div>
          <p className="min-h-[3.5rem]">
            {titleTyped}
            {titleTyped.length < titleText.length && (
              <span className="text-cyan-600 ml-0.5">_</span>
            )}
          </p>
          {introTitleDone && (
            <div className="mt-4 text-sm text-gray-500 min-h-[4rem]">
              <span>{EXAMPLE_IDEAS[exampleIdx]}</span>
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
            </div>
          )}
        </div>
      )}

      {phase === "qa" && (
        <div>
          {qaMessages.map((m, i) => (
            <p
              key={i}
              className={m.user ? "text-gray-500 mt-2 mb-6" : "mb-2"}
            >
              {m.text}
            </p>
          ))}
          {!qaTypingDone && (
            <p>
              {qaTyped}
              <span className="text-cyan-600 ml-0.5">_</span>
            </p>
          )}
          {qaInputVisible && (
            <div className="flex gap-2 mt-2">
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
                className="flex-1 resize-none bg-gray-100 border-0 p-2 focus:outline-none caret-cyan-600"
              />
              <button
                type="button"
                disabled={!qaInput.trim()}
                onClick={proceedQa}
                className="self-start px-3 py-2 border-2 border-gray-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "draw" && (
        <div>
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
              finalizeDrawing();
            }}
            onMouseLeave={() => {
              drawingRef.current = false;
              lastPointRef.current = null;
              finalizeDrawing();
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
              finalizeDrawing();
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
              onClick={() => {
                setDrawingDataUrl(null);
                submitAll();
              }}
              disabled={submitting}
              className="px-4 py-2 border-2 border-gray-800"
            >
              Skip drawing &amp; send
            </button>
            <button
              type="button"
              onClick={submitAll}
              disabled={submitting}
              className="px-4 py-2 border-2 border-black bg-gray-900 text-white"
            >
              Send manifestation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
