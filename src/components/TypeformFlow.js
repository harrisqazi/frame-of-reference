import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import PerimeterTicker from "@/components/PerimeterTicker";
import { NDA_TITLE, ndaParagraphs } from "@/data/nda";

const Logo3D = dynamic(() => import("@/components/Logo3D"), {
  ssr: false,
  loading: () => null,
});
const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

const CYCLING_IDEAS = [
  "Recycling infrastructure in Guadalajara",
  "Pacific Islander Venture Fund",
  "A new app or software tool to help people manage their finances",
  "A solution for reducing plastic waste in the environment",
  "A local solution for improving transportation in a specific city or town",
  "A global solution for addressing climate change.",
  "A service that helps busy parents organize their family schedules and tasks",
  "A solution for turning plastic waste into eco-friendly building materials",
];

const INTRO_QUESTION = "What would you like to create?";
const PATHS = {
  problem: "I have a problem that needs a solution",
  solution: "I have a solution",
};

const QUESTIONS = {
  disclose: "Can we disclose your solution?",
  nda: "Please sign our Non-Disclosure Agreement",
  location: {
    problem: "Where is your problem located?",
    solution: "Where does your solution locate itself?",
  },
  problem: "What is the problem that needs solving?",
  solution: "What is your solution?",
  media: "Upload relevant files or draw your solution",
  contact: "What is your contact information?",
};

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

function stepsFor(path, disclose) {
  if (path === "problem") return ["location", "problem", "contact"];
  return [
    "disclose",
    ...(disclose === false ? ["nda"] : []),
    "location",
    "solution",
    "media",
    "contact",
  ];
}

function questionFor(key, path) {
  return key === "location" ? QUESTIONS.location[path] : QUESTIONS[key];
}

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

function TypedQuestion({ text }) {
  const typed = useTypewriter(text, 26);
  return (
    <p className="mb-4 text-lg text-white">
      {typed}
      {typed.length < text.length && <span className="matrix-cursor" />}
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

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function renderNdaImages(fullName, signatureCanvas) {
  const date = new Date().toLocaleDateString("en-US");
  const W = 1275;
  const margin = 110;
  const body = "22px Georgia, serif";
  const lineH = 32;

  const page = document.createElement("canvas");
  const measure = page.getContext("2d");
  measure.font = body;
  const paragraphs = ndaParagraphs(fullName).map((p) =>
    wrapText(measure, p, W - margin * 2)
  );
  const textHeight = paragraphs.reduce(
    (h, lines) => h + lines.length * lineH + 18,
    0
  );
  page.width = W;
  page.height = margin + 70 + textHeight + 340;

  const ctx = page.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, page.width, page.height);
  ctx.fillStyle = "#111";
  ctx.font = "bold 30px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(NDA_TITLE, W / 2, margin);
  ctx.textAlign = "left";
  ctx.font = body;
  let y = margin + 70;
  paragraphs.forEach((lines) => {
    lines.forEach((l) => {
      ctx.fillText(l, margin, y);
      y += lineH;
    });
    y += 18;
  });

  const drawSignatureBlock = (target, top) => {
    const t = target.getContext("2d");
    t.drawImage(signatureCanvas, margin, top, 500, 160);
    t.strokeStyle = "#111";
    t.lineWidth = 1.5;
    t.beginPath();
    t.moveTo(margin, top + 165);
    t.lineTo(margin + 520, top + 165);
    t.stroke();
    t.fillStyle = "#111";
    t.font = "20px Georgia, serif";
    t.fillText("Signature (Receiving Party)", margin, top + 195);
    t.font = "24px Georgia, serif";
    t.fillText(`Full Name (Receiving Party): ${fullName}`, margin, top + 235);
    t.fillText(`Date: ${date}`, margin, top + 270);
    t.font = "20px Georgia, serif";
    t.fillText(
      "Disclosing Party: Frame of Reference LLC",
      W - margin - 440,
      top + 235
    );
  };

  drawSignatureBlock(page, y + 10);

  return [
    { name: "signed-nda.png", dataUrl: page.toDataURL("image/png") },
  ];
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () =>
      resolve({ name: file.name, type: file.type, size: file.size, dataUrl: r.result });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function LocationStep({ locations, setLocations }) {
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
    <div className="location-grid">
      <div className="matrix-box p-4 font-mono">
        <div className="flex items-center gap-2 border-b border-[rgba(0,255,65,0.35)] pb-2">
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
            placeholder="Select location…"
            className="matrix-input flex-1 text-sm"
            autoFocus
          />
        </div>
        {status && <p className="mt-2 text-xs opacity-70">{status}</p>}
        <ul className="mt-3 space-y-1 text-sm">
          {locations.length === 0 ? (
            <li>◉ Entire world</li>
          ) : (
            locations.map((l) => (
              <li key={l.label} className="flex justify-between gap-2">
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
            ))
          )}
        </ul>
        <p className="mt-3 text-[11px] opacity-50">
          Type a place and press Enter. Add as many as you need.
        </p>
      </div>
      <Globe locations={locations} />
    </div>
  );
}

export default function TypeformFlow({ setStep }) {
  const [path, setPath] = useState(null);
  const [disclose, setDisclose] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [locations, setLocations] = useState([]);
  const [problemText, setProblemText] = useState("");
  const [solutionText, setSolutionText] = useState("");
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [ndaName, setNdaName] = useState("");
  const [ndaAgree, setNdaAgree] = useState(false);
  const [ndaImages, setNdaImages] = useState([]);
  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [tickerItems, setTickerItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [sendSplash, setSendSplash] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const [ideaText, setIdeaText] = useState("");
  const introTyped = useTypewriter(INTRO_QUESTION, 32);
  const introDone = introTyped.length >= INTRO_QUESTION.length;

  const sketchRef = useRef(null);
  const signatureRef = useRef(null);
  const activeRef = useRef(null);
  const wheelLock = useRef(0);

  const [sketchUrl, setSketchUrl] = useState(null);
  const [signed, setSigned] = useState(false);
  const sketch = useDrawPad(sketchRef, {
    color: "#111",
    width: 2,
    onDraw: () => setSketchUrl(sketchRef.current.toDataURL("image/png")),
  });
  const signature = useDrawPad(signatureRef, {
    color: "#0b1f66",
    width: 2.6,
    background: null,
    onDraw: () => setSigned(true),
  });

  const steps = path ? stepsFor(path, disclose) : [];
  const current = steps[stepIdx];

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (path || !introDone) return;
    let idx = 0;
    let pos = 0;
    let deleting = false;
    let timer;
    const tick = () => {
      const full = CYCLING_IDEAS[idx];
      if (!deleting && pos === full.length) {
        deleting = true;
        timer = setTimeout(tick, 900);
        return;
      }
      if (deleting && pos === 0) {
        deleting = false;
        idx = (idx + 1) % CYCLING_IDEAS.length;
      }
      pos += deleting ? -1 : 1;
      setIdeaText(full.slice(0, pos));
      timer = setTimeout(tick, deleting ? 10 : 24);
    };
    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [path, introDone]);

  useEffect(() => {
    if (!path) return;
    fetch(`/api/entries?type=${path === "problem" ? "problems" : "solutions"}`)
      .then((r) => r.json())
      .then((d) => setTickerItems((d.entries || []).map((e) => e.text)))
      .catch(() => {});
  }, [path]);

  useEffect(() => {
    if (current === "media") {
      sketch.clear();
      if (sketchUrl) {
        const img = new Image();
        img.onload = () => sketchRef.current?.getContext("2d").drawImage(img, 0, 0);
        img.src = sketchUrl;
      }
    }
    if (current === "nda") {
      signature.clear();
      setSigned(false);
    }
    const t = setTimeout(
      () => activeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const next = () => setStepIdx((i) => Math.min(i + 1, steps.length - 1));

  useEffect(() => {
    if (current !== "location") return;
    const onWheel = (e) => {
      if (e.deltaY < 40 || Date.now() - wheelLock.current < 1200) return;
      wheelLock.current = Date.now();
      next();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, steps.length]);

  const chooseDisclose = (value) => {
    setDisclose(value);
    if (value) setNdaImages([]);
    setStepIdx(1);
  };

  const signNda = () => {
    const images = renderNdaImages(ndaName.trim(), signatureRef.current);
    setNdaImages(images);
    const [first, ...rest] = ndaName.trim().split(" ");
    setContact((c) => ({
      ...c,
      firstName: c.firstName || first || "",
      lastName: c.lastName || rest.join(" "),
    }));
    next();
  };

  const addFiles = async (list) => {
    setFileError("");
    const picked = Array.from(list || []);
    const all = [...files];
    for (const f of picked) {
      const total = all.reduce((s, x) => s + x.size, 0) + f.size;
      if (total > MAX_UPLOAD_BYTES) {
        setFileError("Files are limited to 3 MB total per submission.");
        break;
      }
      all.push(await readFile(f));
    }
    setFiles(all);
  };

  const locationLabels = locations.length
    ? locations.map((l) => l.label)
    : ["Entire world"];

  const summaryFor = (key) => {
    switch (key) {
      case "disclose":
        return disclose ? "Yes" : "No";
      case "nda":
        return ndaImages.length ? `Signed by ${ndaName}` : "";
      case "location":
        return locationLabels.join(" · ");
      case "problem":
        return problemText;
      case "solution":
        return solutionText;
      case "media":
        return [
          sketchUrl ? "Sketch" : null,
          files.length ? `${files.length} file(s)` : null,
        ]
          .filter(Boolean)
          .join(", ") || "Skipped";
      default:
        return "";
    }
  };

  const submitAll = () => {
    if (submitting) return;
    const answers = steps
      .filter((k) => k !== "contact" && k !== "nda")
      .map((k) => ({ question: questionFor(k, path), answer: summaryFor(k) }));

    const mainText = path === "problem" ? problemText : solutionText;
    const listEntry =
      path === "problem" || disclose
        ? { text: mainText, locations: locationLabels }
        : null;

    const drawingDataUrl = path === "solution" ? sketchUrl : null;

    const payload = {
      kind: path,
      answers,
      contact,
      locations: locationLabels,
      disclose: path === "solution" ? disclose : null,
      ndaImages: disclose === false ? ndaImages : [],
      drawingDataUrl,
      files: files.map(({ name, type, dataUrl }) => ({ name, type, dataUrl })),
      listEntry,
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

  const contactValid =
    contact.firstName.trim() && contact.lastName.trim() && /\S+@\S+\.\S+/.test(contact.email);

  const renderStep = (key) => {
    switch (key) {
      case "disclose":
        return (
          <div className="flex gap-3">
            <button type="button" className="flow-btn flex-1" onClick={() => chooseDisclose(true)}>
              Yes
            </button>
            <button type="button" className="flow-btn flex-1" onClick={() => chooseDisclose(false)}>
              No
            </button>
          </div>
        );
      case "nda":
        return (
          <div>
            <div className="h-64 overflow-y-auto bg-white text-gray-900 p-4 text-xs leading-relaxed font-serif">
              <p className="font-bold text-center mb-3">{NDA_TITLE}</p>
              {ndaParagraphs(ndaName.trim() || "[your name]").map((p, i) => (
                <p key={i} className="mb-2">
                  {p}
                </p>
              ))}
            </div>
            <label className="block mt-4 text-xs text-gray-400">Full legal name</label>
            <input
              className="flow-field mt-1"
              value={ndaName}
              onChange={(e) => setNdaName(e.target.value)}
              placeholder="First Last"
            />
            <label className="block mt-4 text-xs text-gray-400">
              Sign below with your mouse or finger
            </label>
            <canvas
              ref={signatureRef}
              width={500}
              height={160}
              className="w-full mt-1 bg-white touch-none cursor-crosshair"
              {...signature.handlers}
            />
            <button
              type="button"
              onClick={() => {
                signature.clear();
                setSigned(false);
              }}
              className="mt-1 text-xs text-gray-400 underline"
            >
              Clear signature
            </button>
            <label className="flex items-start gap-2 mt-4 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={ndaAgree}
                onChange={(e) => setNdaAgree(e.target.checked)}
                className="mt-1"
              />
              I have read and agree to this Non-Disclosure Agreement, and my typed name
              and drawn signature are my electronic signature.
            </label>
            <button
              type="button"
              className="flow-btn w-full mt-4"
              disabled={!ndaAgree || !ndaName.trim() || !signed}
              onClick={signNda}
            >
              Sign &amp; continue
            </button>
          </div>
        );
      case "location":
        return (
          <div>
            <LocationStep locations={locations} setLocations={setLocations} />
            <button type="button" className="flow-btn w-full mt-4 text-center" onClick={next}>
              Scroll or click to continue ↓
            </button>
          </div>
        );
      case "problem":
      case "solution": {
        const value = key === "problem" ? problemText : solutionText;
        const setValue = key === "problem" ? setProblemText : setSolutionText;
        return (
          <div>
            <textarea
              className="flow-field resize-none"
              rows={5}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="flow-btn w-full mt-3 text-center"
              disabled={!value.trim()}
              onClick={next}
            >
              Next
            </button>
          </div>
        );
      }
      case "media":
        return (
          <div>
            <p className="text-xs text-gray-400 mb-1">Draw your solution</p>
            <canvas
              ref={sketchRef}
              width={360}
              height={220}
              className="w-full bg-white touch-none cursor-crosshair"
              {...sketch.handlers}
            />
            <button
              type="button"
              onClick={() => {
                sketch.clear();
                setSketchUrl(null);
              }}
              className="mt-1 text-xs text-gray-400 underline"
            >
              Clear drawing
            </button>
            <label className="block mt-4 text-sm text-[color:var(--matrix)] underline cursor-pointer">
              Upload files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            {fileError && <p className="text-xs text-red-400 mt-1">{fileError}</p>}
            {files.length > 0 && (
              <ul className="mt-2 text-xs text-gray-300 space-y-1">
                {files.map((f) => (
                  <li key={f.name} className="flex justify-between">
                    <span>{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((all) => all.filter((x) => x.name !== f.name))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="flow-btn w-full mt-4 text-center" onClick={next}>
              Next
            </button>
          </div>
        );
      case "contact":
        return (
          <div className="grid gap-3">
            {[
              ["firstName", "First name", "text"],
              ["lastName", "Last name", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone number", "tel"],
            ].map(([field, label, type]) => (
              <label key={field} className="text-xs text-gray-400">
                {label}
                <input
                  type={type}
                  className="flow-field mt-1"
                  value={contact[field]}
                  onChange={(e) => setContact((c) => ({ ...c, [field]: e.target.value }))}
                />
              </label>
            ))}
            <button
              type="button"
              className="flow-btn w-full mt-2 text-center"
              disabled={!contactValid || submitting}
              onClick={submitAll}
            >
              {path === "problem" ? "Send problem" : "Send solution"}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {path && <PerimeterTicker items={tickerItems} />}

      {portalReady &&
        sendSplash &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] manifestation-send-overlay manifestation-send-overlay--active pointer-events-none"
            aria-live="polite"
          >
            <div className="manifestation-logo-stage">
              <Logo3D sending className="manifestation-logo-send" />
              <p className="manifestation-send-caption">Sending…</p>
            </div>
          </div>,
          document.body
        )}

      <div className="relative z-20 max-w-[720px] w-11/12 text-white pt-8 pb-24 font-mono mx-auto">
        {!path && (
          <div>
            <p className="text-lg min-h-[2rem]">
              {introTyped}
              {!introDone && <span className="matrix-cursor" />}
            </p>
            {introDone && (
              <>
                <p className="mt-3 text-sm text-gray-500 min-h-[3rem]">
                  {ideaText}
                  <span className="matrix-cursor" />
                </p>
                <div className="mt-6 grid gap-3">
                  {Object.entries(PATHS).map(([key, label], i) => (
                    <button
                      key={key}
                      type="button"
                      className="flow-btn path-choice"
                      onClick={() => {
                        setPath(key);
                        setStepIdx(0);
                      }}
                    >
                      {i + 1}. {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {path && (
          <ol className="list-none m-0 p-0">
            <li className="pb-4 mb-4 border-b border-gray-800 text-sm">
              <p className="text-gray-500 text-xs">{INTRO_QUESTION}</p>
              <button
                type="button"
                className="text-left hover:text-[color:var(--matrix)]"
                onClick={() => {
                  setPath(null);
                  setDisclose(null);
                  setStepIdx(0);
                }}
              >
                {PATHS[path]}
              </button>
            </li>
            {steps.slice(0, stepIdx).map((key, i) => (
              <li key={key} className="pb-4 mb-4 border-b border-gray-800 text-sm">
                <p className="text-gray-500 text-xs">{questionFor(key, path)}</p>
                <button
                  type="button"
                  className="text-left hover:text-[color:var(--matrix)]"
                  onClick={() => setStepIdx(i)}
                >
                  {summaryFor(key) || "—"}
                </button>
              </li>
            ))}
            {current && (
              <li ref={activeRef} className="scroll-mt-8 pb-6">
                <p className="mb-1 text-xs text-[color:var(--matrix)]">
                  Question {stepIdx + 1} of {steps.length}
                </p>
                <TypedQuestion key={current} text={questionFor(current, path)} />
                {renderStep(current)}
              </li>
            )}
          </ol>
        )}
      </div>
    </>
  );
}
