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



function SwatchRow({
  label,
  hex,
  onCopy,
}: { label: number; hex?: string; onCopy: (h: string) => void }) {
  const v = hex || "#eeeeee";
  const text = bestOn(v);
  const rB = contrastRatio(v, "#000000");
  const rW = contrastRatio(v, "#ffffff");
  const useBlack = rB >= rW;
  const ratio = (useBlack ? rB : rW).toFixed(2);
  const dot = useBlack ? "#000000" : "#ffffff";
}: { label: number; hex?: string; onCopy: (h: string) => void }) {
  const v = hex || "#eeeeee";
  const text = bestOn(v);
  const rB = contrastRatio(v, "#000000");
  const rW = contrastRatio(v, "#ffffff");
  const useBlack = rB >= rW;
  const ratio = (useBlack ? rB : rW).toFixed(2);
  const dot = useBlack ? "#000000" : "#ffffff";

  return (
       <div
      className="sw-row"
      style={{ background: v, color: text }}
      onClick={() => onCopy(v)}
      title={`${label} ${v}`}
    >
      <div className="sw-name">{label}</div>
      <A11yPill hex={v} />
      <A11yPill hex={v} />
      <div className="sw-hex">{v.toUpperCase()}</div>
    </div>

  );

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



  /* =========================================================
     MISE EN FORME FINALE
     ========================================================= */

  return (
    <div className="ui-wrap">
      <div className="brand-row">
        <div className="brand-left">
          <span className="sprout">🌱</span>
          <div className="brand-texts">
            <div className="brand">Starter’s globals generator</div>
            <div className="muted">Génère et applique tes palettes (C1, C2, C3, Neutral — max. 2% C1 500)</div>
          </div>
        </div>
        <button className="btn btn--invert" onClick={replaceVariables}>
          <span className="material-icons mi-16">refresh</span>
          <span>Replace variables</span>
        </button>

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

