import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import PerimeterTicker from "@/components/PerimeterTicker";
import HEALING_ITEMS from "@/data/healing.json";

const Logo3D = dynamic(() => import("@/components/Logo3D"), {
  ssr: false,
  loading: () => null,
});
const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

const STEPS = ["healing", "contact", "drawing", "location", "send"];

const QUESTIONS = {
  healing: "What needs healing?",
  contact: "Who should we reach?",
  drawing: "Draw something.",
  location: "Where is your healing located?",
  send: "Send it.",
};

const SKIP_GRACE_MS = 800;

function useTypewriter(text, speed = 28) {
  const [out, setOut] = useState("");
  useEffect(() => {
    let i = 0;
    setOut("");
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return out;
}

function TypedQuestion({ text, className = "mb-4 text-lg text-white", onDone }) {
  const typed = useTypewriter(text, 40);
  const done = typed.length >= text.length;
  useEffect(() => {
    if (done) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  return (
    <p className={className}>
      {typed}
      {!done && <span className="matrix-cursor" />}
    </p>
  );
}

function useDrawPad(ref, { color = "#111", width = 2, background = "#fff", onDraw }) {
  const drawing = useRef(false);
  const last = useRef(null);

  const clear = () => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, c.width, c.height);
    }
  };

  const point = (e) => {
    const c = ref.current;
    const r = c.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - r.left) * (c.width / r.width),
      y: (src.clientY - r.top) * (c.height / r.height),
    };
  };

  const start = (e) => {
    if (e.touches) e.preventDefault();
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e) => {
    if (!drawing.current || !last.current) return;
    if (e.touches) e.preventDefault();
    const p = point(e);
    const ctx = ref.current.getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    if (drawing.current) onDraw?.();
    drawing.current = false;
    last.current = null;
  };

  return {
    clear,
    handlers: {
      onMouseDown: start,
      onMouseMove: move,
      onMouseUp: end,
      onMouseLeave: end,
      onTouchStart: start,
      onTouchMove: move,
      onTouchEnd: end,
    },
  };
}

function LocationSearch({ locations, setLocations }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setStatus("Searching…");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      const [hit] = await res.json();
      if (!hit) {
        setStatus(`No match for “${q}”`);
        return;
      }
      const label = hit.display_name.split(",").slice(0, 3).join(",").trim();
      setLocations((prev) =>
        prev.some((l) => l.label === label)
          ? prev
          : [...prev, { label, lat: Number(hit.lat), lng: Number(hit.lon) }]
      );
      setQuery("");
      setStatus("");
    } catch {
      setStatus("Search unavailable — try again");
    }
  };

  return (
    <div className="matrix-box p-3 font-mono text-sm">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="10.5" cy="10.5" r="6.5" stroke="#008f11" strokeWidth="2" />
          <path d="M15.5 15.5 21 21" stroke="#008f11" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          enterKeyHint="search"
          placeholder="Type a place and press Enter…"
          className="matrix-input flex-1 min-w-0"
        />
      </div>
      {status && <p className="mt-1 text-xs opacity-70">{status}</p>}
      {locations.length > 0 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto text-xs whitespace-nowrap">
          {locations.map((l) => (
            <li key={l.label} className="flex items-center gap-1 border border-[rgba(0,143,17,0.5)] px-2 py-0.5">
              <span>◉ {l.label}</span>
              <button
                type="button"
                aria-label={`Remove ${l.label}`}
                onClick={() =>
                  setLocations((prev) => prev.filter((p) => p.label !== l.label))
                }
                className="opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TypeformFlow({ setStep }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [healingText, setHealingText] = useState("");
  const [healingReady, setHealingReady] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "" });
  const [locations, setLocations] = useState([]);
  const [skipLocation, setSkipLocation] = useState(false);
  const [sketchUrl, setSketchUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendSplash, setSendSplash] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const sketchRef = useRef(null);
  const healingRef = useRef(null);
  const activeRef = useRef(null);
  const reachedAtRef = useRef(0);

  const current = STEPS[stepIdx];
  const sketch = useDrawPad(sketchRef, {
    color: "#111",
    width: 2.4,
    onDraw: () => setSketchUrl(sketchRef.current.toDataURL("image/png")),
  });

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    reachedAtRef.current = performance.now();
    if (current === "drawing") sketch.clear();
    if (stepIdx === 0) return;
    const t = setTimeout(
      () => activeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  useEffect(() => {
    if (healingReady) healingRef.current?.focus();
  }, [healingReady]);

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));

  // Scrolling or swiping onward skips the drawing.
  useEffect(() => {
    if (current !== "drawing") return;
    const canSkip = () => performance.now() - reachedAtRef.current > SKIP_GRACE_MS;
    const onWheel = (e) => {
      if (e.deltaY > 40 && canSkip()) next();
    };
    let startY = null;
    const onTouchStart = (e) => {
      startY = e.target === sketchRef.current ? null : e.touches[0]?.clientY;
    };
    const onTouchEnd = (e) => {
      const endY = e.changedTouches[0]?.clientY;
      if (startY != null && endY != null && startY - endY > 60 && canSkip()) next();
      startY = null;
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const locationLabels =
    !skipLocation && locations.length
      ? locations.map((l) => l.label)
      : ["Not specified"];

  const contactValid = contact.name.trim() && /\S+@\S+\.\S+/.test(contact.email);

  const submitAll = () => {
    if (submitting) return;
    const [firstName, ...rest] = contact.name.trim().split(/\s+/);
    const payload = {
      kind: "healing",
      answers: [
        { question: QUESTIONS.healing, answer: healingText.trim() },
        { question: QUESTIONS.location, answer: locationLabels.join(" · ") },
        { question: QUESTIONS.drawing, answer: sketchUrl ? "Attached" : "Skipped" },
      ],
      contact: {
        firstName: firstName || "",
        lastName: rest.join(" "),
        email: contact.email.trim(),
        phone: "",
      },
      locations: locationLabels,
      drawingDataUrl: sketchUrl,
      files: [],
      listEntry: null,
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
        if (!data.emailed) console.warn("Email not sent — see EMAIL_SETUP.md", data);
      })
      .catch((err) => console.error("submit failed:", err));

    setTimeout(() => {
      setSubmitting(false);
      setSendSplash(false);
      setStep(7);
    }, 4200);
  };

  const sectionProps = (key) => ({
    ref: key === current ? activeRef : null,
    className:
      key === "location" || key === "send"
        ? "scroll-mt-0 h-[100dvh] flex flex-col py-8"
        : "scroll-mt-8 pb-10",
  });

  const renderStep = (key) => {
    switch (key) {
      case "healing":
        return (
          <>
            <TypedQuestion
              text={QUESTIONS.healing}
              className="mb-4 text-2xl text-white"
              onDone={() => setHealingReady(true)}
            />
            <textarea
              ref={healingRef}
              className="healing-bubble"
              rows={5}
              value={healingText}
              onChange={(e) => setHealingText(e.target.value)}
              disabled={!healingReady}
              placeholder="Type freely…"
            />
            {current === "healing" && (
              <button
                type="button"
                className={`flow-btn w-full mt-3 text-center transition-opacity duration-700 ${
                  healingReady ? "opacity-100" : "opacity-0"
                }`}
                disabled={!healingText.trim()}
                onClick={next}
              >
                Next
              </button>
            )}
          </>
        );
      case "contact":
        return (
          <>
            <TypedQuestion text={QUESTIONS.contact} />
            <div className="grid gap-3">
              <label className="text-xs text-gray-400">
                Name
                <input
                  className="flow-field mt-1"
                  autoComplete="name"
                  value={contact.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                />
              </label>
              <label className="text-xs text-gray-400">
                Email
                <input
                  type="email"
                  className="flow-field mt-1"
                  autoComplete="email"
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                />
              </label>
              {current === "contact" && (
                <button
                  type="button"
                  className="flow-btn w-full text-center"
                  disabled={!contactValid}
                  onClick={next}
                >
                  Next
                </button>
              )}
            </div>
          </>
        );
      case "drawing":
        return (
          <>
            <TypedQuestion text={QUESTIONS.drawing} />
            <canvas
              ref={sketchRef}
              width={360}
              height={220}
              className="w-full bg-white touch-none cursor-crosshair"
              {...sketch.handlers}
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <button
                type="button"
                onClick={() => {
                  sketch.clear();
                  setSketchUrl(null);
                }}
                className="underline"
              >
                Clear drawing
              </button>
              <span>Optional — scroll to skip ↓</span>
            </div>
            {current === "drawing" && (
              <button type="button" className="flow-btn w-full mt-4 text-center" onClick={next}>
                {sketchUrl ? "Next" : "Skip"}
              </button>
            )}
          </>
        );
      case "location":
        return (
          <>
            <TypedQuestion text={QUESTIONS.location} className="mb-3 text-lg text-white" />
            <LocationSearch locations={locations} setLocations={setLocations} />
            <div className="flex-1 min-h-0 py-3">
              <div className="globe-fit">
                <Globe locations={skipLocation ? [] : locations} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipLocation}
                  onChange={(e) => {
                    setSkipLocation(e.target.checked);
                    if (e.target.checked && current === "location") next();
                  }}
                />
                Skip
              </label>
              {current === "location" && (
                <button
                  type="button"
                  className="flow-btn text-center"
                  disabled={!locations.length}
                  onClick={next}
                >
                  Continue ↓
                </button>
              )}
            </div>
          </>
        );
      case "send":
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-10">
            <TypedQuestion text={QUESTIONS.send} className="text-3xl text-white" />
            <button
              type="button"
              className="send-it-btn font-mono"
              disabled={submitting}
              onClick={submitAll}
            >
              Send
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {healingReady && <PerimeterTicker items={HEALING_ITEMS} />}

      {portalReady &&
        sendSplash &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] manifestation-send-overlay manifestation-send-overlay--active pointer-events-none"
            aria-live="polite"
          >
            <div className="manifestation-logo-stage">
              <Logo3D sending className="manifestation-logo-send" />
              <p className="manifestation-send-caption">We will be in contact.</p>
            </div>
          </div>,
          document.body
        )}

      <div className="relative z-20 max-w-[720px] w-11/12 text-white pt-8 font-mono mx-auto">
        {STEPS.slice(0, stepIdx + 1).map((key) => (
          <section key={key} {...sectionProps(key)}>
            {renderStep(key)}
          </section>
        ))}
      </div>
    </>
  );
}
