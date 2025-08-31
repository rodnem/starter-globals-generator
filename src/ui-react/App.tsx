import React, { useEffect, useMemo, useState } from "react";
import { buildCalcss, buildScss, type Palette } from "./exportUtils"

// --- Mini toast UI côté iframe (aucun lien avec figma.notify) ---
(function initUIToast() {
  if ((window as any).showToast) return; // évite de ré-attacher

  (window as any).showToast = function showToast(msg: string) {
    const id = "ui-toast-host";
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement("div");
      host.id = id;
      host.style.position = "fixed";
      host.style.right = "16px";
      host.style.bottom = "16px";
      host.style.zIndex = "9999";
      document.body.appendChild(host);
    }
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.background = "rgba(0,0,0,0.85)";
    toast.style.color = "#fff";
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "10px";
    toast.style.marginTop = "8px";
    toast.style.fontSize = "12px";
    toast.style.boxShadow = "0 6px 20px rgba(0,0,0,.25)";
    toast.style.transition = "opacity .2s ease";
    host.appendChild(toast);

    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => host && toast.remove(), 200);
    }, 1200);
  };
})();



function safeCopy(text: string) {
  const value = String(text || "").trim();
  if (!value) return;

  // 1) Essai avec l’API Clipboard (Figma la fournit dans l’UI)
  const clip = (navigator as any).clipboard;
  if (clip && typeof clip.writeText === "function") {
    clip.writeText(value).catch(() => fallback());
  } else {
    fallback();
  }

  function fallback() {
    // Fallback DOM (execCommand)
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch { }
    document.body.removeChild(ta);
  }

  // Optionnel : petit toast si tu en as déjà un
  showToast?.(`Copied ${value.toUpperCase()}`);
  const safeCopy = (value: string) => {
    navigator?.clipboard?.writeText?.(value).catch(() => { });
    // toast non bloquant
    const w: any = window;
    if (w && typeof w.showToast === "function") {
      w.showToast(`Copied ${value.toUpperCase()}`);
    }
  };
}



/** ----- Constantes UI ----- */
const STEPS = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const DEFAULTS = {
  c1: "#639720",
  c2: "#ffe600",
  c3: "#007a7a",
}

/** ----- Helpers sûrs (compat Figma) ----- */
function ensureHex(str?: string) {
  if (!str) return "#000000"
  let s = String(str).trim()
  if (s[0] !== "#") s = "#" + s
  if (s.length === 4) s = "#" + s.slice(1).split("").map((c) => c + c).join("")
  if (s.length !== 7) return "#000000"
  return s.toLowerCase()
}
function srgbToLin(c: number) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
function relLuminance(hex: string) {
  const n = parseInt(ensureHex(hex).slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}
function contrastRatio(a: string, b: string) {
  const L1 = relLuminance(a), L2 = relLuminance(b)
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2)
  return (hi + 0.05) / (lo + 0.05)
}
function bestOn(bg: string) {
  const cb = contrastRatio(bg, "#000000")
  const cw = contrastRatio(bg, "#ffffff")
  return cb >= cw ? "#000000" : "#ffffff"
}

function A11yPill({ hex }: { hex: string }) {
  const rBlack = Number(contrastRatio(hex, "#000000").toFixed(2))
  const rWhite = Number(contrastRatio(hex, "#ffffff").toFixed(2))

  // Seuils WCAG AA
  const passG = (r: number) => r >= 3.0   // ◈ Graphismes / UI
  const passT = (r: number) => r >= 3.0   // T Texte large
  const passN = (r: number) => r >= 4.5   // ☰ Texte normal

  return (
    <div className="a11y-pill" aria-label="Vérification de contraste">
      <div className="a11y-side">
        {/* <span className="a11y-dot" style={{ background: "#000" }} /> */}
        <span className="a11y-r">{rBlack.toFixed(2)}</span>
        <span className={`a11y-ic ${passG(rBlack) ? "ok" : "ko"}`}>◈</span>
        <span className={`a11y-ic ${passT(rBlack) ? "ok" : "ko"}`}>T</span>
        <span className={`a11y-ic ${passN(rBlack) ? "ok" : "ko"}`}>☰</span>
      </div>
      <div className="a11y-side">
        {/* <span
          className="a11y-dot"
          style={{ background: "#fff", outline: "1px solid rgba(0,0,0,.35)" }}
        /> */}
        <span className="a11y-r">{rWhite.toFixed(2)}</span>
        <span className={`a11y-ic ${passG(rWhite) ? "ok" : "ko"}`}>◈</span>
        <span className={`a11y-ic ${passT(rWhite) ? "ok" : "ko"}`}>T</span>
        <span className={`a11y-ic ${passN(rWhite) ? "ok" : "ko"}`}>☰</span>
      </div>
    </div>
  )
}



/** ----- Parse le CSS envoyé par le main en palettes ----- */
function parseCssToPalettes(css: string) {
  // css attendu: ":root{--c1-25:#xxxxxx;--c1-50:#xxxxxx;...--neutral-950:#xxxxxx}"
  const groups = { c1: {} as Record<number, string>, c2: {} as Record<number, string>, c3: {} as Record<number, string>, neutral: {} as Record<number, string> }
  const re = /--(c1|c2|c3|neutral)-(\d{2,3}):\s*(#[0-9a-fA-F]{6})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const g = m[1] as "c1" | "c2" | "c3" | "neutral"
    const step = parseInt(m[2], 10) as number
    groups[g][step] = m[3].toLowerCase()
  }
  return groups
}

function CardHead({
  title, value, readOnly, onChange, subtitle
}: {
  title: string
  value: string
  readOnly?: boolean
  onChange?: (v: string) => void
  /** ← accepte maintenant du JSX pour pouvoir mettre une checkbox */
  subtitle?: React.ReactNode
}) {
  const bg = ensureHex(value)
  const fg = bestOn(bg)
  return (
    <div className="card-head" style={{ background: bg, color: fg }}>
      <div className="head-left">
        <div className="head-title">{title}</div>
        {subtitle ? <div className="head-sub">{subtitle}</div> : null}
      </div>
      <input
        className={"head-input" + (readOnly ? " head-input--ro" : "")}
        value={value}
        readOnly={!!readOnly}
        tabIndex={readOnly ? -1 : 0}
        spellCheck={false}
        onChange={(e) => !readOnly && onChange && onChange(e.target.value)}
      />
    </div>
  )
}



type SwatchRowProps = {
  label: number;
  hex?: string;
  onCopy: (h: string) => void;
};

function SwatchRow({ label, hex, onCopy }: SwatchRowProps) {
  const v = hex || "#eeeeee";
  const text = bestOn(v);
  const rB = contrastRatio(v, "#000000");
  const rW = contrastRatio(v, "#ffffff");

  return (
    <div
      className="sw-row"
      style={{ background: v, color: text }}
      onClick={() => onCopy(v)}
      title={`${label} ${v}`}
    >
      <div className="sw-name">{label}</div>
      <A11yPill hex={v} />
      <div className="sw-hex">{v.toUpperCase()}</div>
    </div>
  );
}




function ColumnCard({
  title, value, palette, readOnly, onChange, subtitle
}: {
  title: string
  value: string
  palette: Record<number, string | undefined>
  readOnly?: boolean
  onChange?: (v: string) => void
  subtitle?: string
}) {
  return (
    <div className="col-card">
      <CardHead title={title} value={value} readOnly={readOnly} onChange={onChange} subtitle={subtitle} />
      <div>
        {STEPS.map((s) => (
          <SwatchRow key={s} label={s} hex={palette?.[s]} onCopy={safeCopy} />))}
      </div>

    </div>
  )
}


/** ----- App (UI only) ----- */
export default function App() {
  // Références utilisateur (modifiables)
  const [c1, setC1] = useState(DEFAULTS.c1)
  const [c2, setC2] = useState(DEFAULTS.c2)
  const [c3, setC3] = useState(DEFAULTS.c3)
  // Référence Neutral (champ débloquable) — par défaut verrouillé
  const [neutralLocked, setNeutralLocked] = useState(true);
  const [neutralManual, setNeutralManual] = useState("#808080");

  // CSS reçu du main + palettes parsées
  const [css, setCss] = useState<string>("")
  const palettes = useMemo(() => parseCssToPalettes(css), [css])


  // Génération de l'export CSS standard (hex)
  const cssExport = useMemo(() => {
    let out = ":root {\n"
    for (const [name, palette] of Object.entries(palettes)) {
      for (const [step, hex] of Object.entries(palette)) {
        out += `  --${name}-${step}: ${hex};\n`
      }
    }
    out += "}"
    return out
  }, [palettes])

  // Neutral 500 dérivé de la palette générée (lecture seule)
  const neutral500 = palettes?.neutral?.[500] || "#808080";
  const neutralInputValue = neutralLocked ? neutral500 : neutralManual;

  const neutralSubtitle = (
    <label style={{ display: "inline-flex", gap: 2, alignItems: "center", fontWeight: 400 }}>
      <input
        type="checkbox"
        checked={neutralLocked}
        onChange={(e) => setNeutralLocked(e.target.checked)}
      />
      <span>max. 2% C1 500</span>
    </label>
  )


  /** Listen CSS_READY du main (on ne touche pas à la logique) */
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const m = (e.data && (e.data as any).pluginMessage) || null
      if (!m) return
      if (m.type === "CSS_READY" && m.payload && typeof m.payload.css === "string") {
        setCss(m.payload.css)
      }
    }
    window.addEventListener("message", onMsg as any)
    return () => window.removeEventListener("message", onMsg as any)
  }, [])

  /** Envoi GENERATE au main à chaque frappe (ne change pas le protocole) */
  useEffect(() => {
    parent.postMessage({
      pluginMessage: {
        type: "GENERATE",
        payload: {
          c1: ensureHex(c1),
          c2: ensureHex(c2),
          c3: ensureHex(c3),
          // ↓↓↓ ajout pour neutral
          neutralUnlocked: !neutralLocked,            // true si case décochée
          neutralManual: ensureHex(neutralManual),    // base neutral saisie
        },
      },
    }, "*")
  }, [c1, c2, c3, neutralLocked, neutralManual]) // ← ajoute aussi ces deps


  /** Bouton Replace variables (même message) */
  const replaceVariables = () => {
    parent.postMessage({
      pluginMessage: {
        type: "REPLACE_VARIABLES",
        payload: {
          c1: ensureHex(c1),
          c2: ensureHex(c2),
          c3: ensureHex(c3),
          // ↓↓↓ même logique côté replace
          neutralUnlocked: !neutralLocked,
          neutralManual: ensureHex(neutralManual),
        },
      },
    }, "*")
  }
  // Nouvelle fonction pour générer les frames
  const generateFrames = () => {
    parent.postMessage({
      pluginMessage: {
        type: "GENERATE_FRAMES",
        payload: {
          c1: ensureHex(c1),
          c2: ensureHex(c2),
          c3: ensureHex(c3),
          neutralUnlocked: !neutralLocked,
          neutralManual: ensureHex(neutralManual),
        },
      },
    }, "*")
  }


  /* =========================================================
     MISE EN FORME FINALE
     ========================================================= */

  return (
    <div className="ui-wrap">
      <div className="brand-row">
        <div className="brand-left">
          <span className="sprout">🌱</span>
          <div className="brand-texts">
            <div className="brand">Starter's globals generator</div>
            <div className="muted">Génère tes palettes & remplace tes variables (Génération HSLuv ou Lab)</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn" onClick={generateFrames}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.66634 10.6666C4.53449 10.6666 4.40559 10.7057 4.29596 10.779C4.18633 10.8523 4.10088 10.9564 4.05042 11.0782C3.99996 11.2 3.98676 11.3341 4.01248 11.4634C4.03821 11.5927 4.1017 11.7115 4.19494 11.8047C4.28817 11.898 4.40696 11.9614 4.53628 11.9872C4.6656 12.0129 4.79965 11.9997 4.92146 11.9492C5.04328 11.8988 5.1474 11.8133 5.22065 11.7037C5.29391 11.5941 5.33301 11.4652 5.33301 11.3333C5.33301 11.1565 5.26277 10.9869 5.13775 10.8619C5.01272 10.7369 4.84315 10.6666 4.66634 10.6666ZM12.7063 7.99998L13.5263 7.17998C13.9009 6.80498 14.1112 6.29665 14.1112 5.76665C14.1112 5.23664 13.9009 4.72831 13.5263 4.35331L11.6397 2.47331C11.2647 2.09878 10.7563 1.88841 10.2263 1.88841C9.69634 1.88841 9.18801 2.09878 8.81301 2.47331L7.99967 3.29331C7.9892 2.76984 7.77388 2.27135 7.39993 1.90489C7.02599 1.53842 6.52325 1.33321 5.99967 1.33331H3.33301C2.80257 1.33331 2.29387 1.54403 1.91879 1.9191C1.54372 2.29417 1.33301 2.80288 1.33301 3.33331V12.6666C1.33301 13.1971 1.54372 13.7058 1.91879 14.0809C2.29387 14.4559 2.80257 14.6666 3.33301 14.6666H12.6663C13.1968 14.6666 13.7055 14.4559 14.0806 14.0809C14.4556 13.7058 14.6663 13.1971 14.6663 12.6666V9.99998C14.6664 9.47641 14.4612 8.97367 14.0948 8.59972C13.7283 8.22578 13.2298 8.01045 12.7063 7.99998ZM6.66634 12.6666C6.66634 12.8435 6.5961 13.013 6.47108 13.1381C6.34605 13.2631 6.17649 13.3333 5.99967 13.3333H3.33301C3.1562 13.3333 2.98663 13.2631 2.8616 13.1381C2.73658 13.013 2.66634 12.8435 2.66634 12.6666V3.33331C2.66634 3.1565 2.73658 2.98693 2.8616 2.86191C2.98663 2.73688 3.1562 2.66665 3.33301 2.66665H5.99967C6.17649 2.66665 6.34605 2.73688 6.47108 2.86191C6.5961 2.98693 6.66634 3.1565 6.66634 3.33331V12.6666ZM7.99967 5.17331L9.75967 3.41331C9.88458 3.28915 10.0536 3.21945 10.2297 3.21945C10.4058 3.21945 10.5748 3.28915 10.6997 3.41331L12.5863 5.33331C12.7105 5.45822 12.7802 5.62719 12.7802 5.80331C12.7802 5.97944 12.7105 6.1484 12.5863 6.27331L10.6663 8.19331L7.99967 10.8266V5.17331ZM13.333 12.6666C13.333 12.8435 13.2628 13.013 13.1377 13.1381C13.0127 13.2631 12.8432 13.3333 12.6663 13.3333H7.87967C7.94806 13.1357 7.98627 12.929 7.99301 12.72L11.3797 9.33331H12.6663C12.8432 9.33331 13.0127 9.40355 13.1377 9.52858C13.2628 9.6536 13.333 9.82317 13.333 9.99998V12.6666Z" fill="black" />
            </svg>

            <span>Generate frames</span>
          </button>
          <button className="btn btn--invert" onClick={replaceVariables}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.99967 7.99998C9.99967 6.86665 9.13301 5.99998 7.99967 5.99998C6.86634 5.99998 5.99967 6.86665 5.99967 7.99998C5.99967 9.13331 6.86634 9.99998 7.99967 9.99998C9.13301 9.99998 9.99967 9.13331 9.99967 7.99998ZM11.333 2.19998C8.73301 0.733313 5.53301 1.19998 3.39967 3.13331V1.99998C3.39967 1.59998 3.13301 1.33331 2.73301 1.33331C2.33301 1.33331 2.06634 1.59998 2.06634 1.99998V4.99998C2.06634 5.39998 2.33301 5.66665 2.73301 5.66665H5.73301C6.13301 5.66665 6.39967 5.39998 6.39967 4.99998C6.39967 4.59998 6.13301 4.33331 5.73301 4.33331H4.13301C5.13301 3.26665 6.53301 2.66665 7.99967 2.66665C10.933 2.66665 13.333 5.06665 13.333 7.99998C13.333 8.39998 13.5997 8.66665 13.9997 8.66665C14.3997 8.66665 14.6663 8.39998 14.6663 7.99998C14.6663 5.59998 13.3997 3.39998 11.333 2.19998ZM13.2663 10.3333H10.2663C9.86634 10.3333 9.59967 10.6 9.59967 11C9.59967 11.4 9.86634 11.6666 10.2663 11.6666H11.8663C10.8663 12.7333 9.46634 13.3333 7.99967 13.3333C5.06634 13.3333 2.66634 10.9333 2.66634 7.99998C2.66634 7.59998 2.39967 7.33331 1.99967 7.33331C1.59967 7.33331 1.33301 7.59998 1.33301 7.99998C1.33301 11.6666 4.33301 14.6666 7.99967 14.6666C9.73301 14.6666 11.333 14 12.5997 12.8V14C12.5997 14.4 12.8663 14.6666 13.2663 14.6666C13.6663 14.6666 13.933 14.4 13.933 14V11C13.933 10.6 13.5997 10.3333 13.2663 10.3333Z" fill="white" />
            </svg>

            <span>Replace variables</span>
          </button>
        </div>
      </div>

      <div className="grid grid-4 gap-3">
        <ColumnCard title="Brand C1" value={c1} onChange={setC1} palette={palettes.c1 || {}} />
        <ColumnCard title="Brand C2" value={c2} onChange={setC2} palette={palettes.c2 || {}} />
        <ColumnCard title="Brand C3" value={c3} onChange={setC3} palette={palettes.c3 || {}} />
        <ColumnCard title="Brand Neutral" value={neutralInputValue} readOnly={neutralLocked} onChange={(v) => !neutralLocked && setNeutralManual(v)} subtitle={neutralSubtitle} palette={palettes.neutral || {}} />
      </div>

      {/* --- Export for dev --- */}
      <div className="col-card">
        <div className="card-head" style={{ justifyContent: "space-between" }}>
          <div className="head-title">Export for dev</div>
          <div className="export-actions" style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn"
              onClick={() => {
                // CSS standard (ta variable cssExport, ou css si c’est la bonne)
                safeCopy(cssExport);
              }}
            >
              CSS
            </button>
            <button
              className="btn"
              onClick={() => {
                // CALCSS (bases + palettes + steps)
                // bases = { c1, c2, c3, neutral: neutral500 }
                safeCopy(
                  buildCalcss(
                    { c1, c2, c3, neutral: neutral500 },
                    palettes,
                    STEPS
                  )
                );
              }}
            >
              CALCSS
            </button>
            <button
              className="btn"
              onClick={() => {
                // SCSS (palettes + steps)
                safeCopy(buildScss(palettes, STEPS));
              }}
            >
              SCSS
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

