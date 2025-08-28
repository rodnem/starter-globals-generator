// ===== Figma MAIN (compat ES5) =====
figma.showUI(__html__, { width: 980, height: 660 });
figma.notify("MAIN loaded (ES5 safe)");

// ---------- Helpers couleurs (ES5) ----------
function ensureHex(str) {
  if (!str) return "#000000";
  var s = String(str).trim();
  if (s.charAt(0) !== "#") s = "#" + s;
  if (s.length === 4) {
    s = "#" + s.slice(1).split("").map(function (c) { return c + c; }).join("");
  }
  if (s.length !== 7) return "#000000";
  return s.toLowerCase();
}
function hexToRgb(hex) {
  hex = ensureHex(hex);
  var n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function _rgbToHex(r, g, b) {
  function h(n) { var s = n.toString(16); return s.length === 1 ? "0" + s : s; }
  return "#" + h(r) + h(g) + h(b);
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    var v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  var r = hue2rgb(p, q, h + 1/3), g = hue2rgb(p, q, h), b = hue2rgb(p, q, h - 1/3);
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function mixHex(aHex, bHex, t) {
  var A = hexToRgb(aHex), B = hexToRgb(bHex);
  var k = Math.max(0, Math.min(1, t));
  return _rgbToHex(
    Math.round(A.r + (B.r - A.r) * k),
    Math.round(A.g + (B.g - A.g) * k),
    Math.round(A.b + (B.b - A.b) * k)
  );
}

// ---------- Génération palettes 25→950 ----------
var STEPS = [25,50,100,200,300,400,500,600,700,800,900,950];
var LIGHTEN = {25:0.92,50:0.85,100:0.75,200:0.60,300:0.45,400:0.30};
var DARKEN  = {600:0.16,700:0.30,800:0.45,900:0.60,950:0.75};

function scaleFromBase(baseHex) {
  baseHex = ensureHex(baseHex);
  var scale = { 500: baseHex };
  var white = "#ffffff", black = "#000000", k;
  for (k in LIGHTEN) scale[+k] = mixHex(baseHex, white, LIGHTEN[k]);
  for (k in DARKEN)  scale[+k] = mixHex(baseHex, black, DARKEN[k]);
  return scale;
}

// ---------- CSS builder (inclut neutral basé sur C1-500) ----------
function buildCssVars(c1, c2, c3) {
  c1 = ensureHex(c1); c2 = ensureHex(c2); c3 = ensureHex(c3);

  var c1S = scaleFromBase(c1);
  var c2S = scaleFromBase(c2);
  var c3S = scaleFromBase(c3);

  // --- Neutral : base échelle de gris, TEINTURE max 2% par C1-500 sur CHAQUE step ---
var grey500 = "#808080";
var c1_500  = c1S[500];

// 1) Échelle de gris pure (25→950) à partir de #808080
var nPure = scaleFromBase(grey500); // pur gris clair↔sombre

// 2) Teinte chaque nuance avec C1-500 à hauteur de 2% (max)
//    => nS[k] = mix( nPure[k], C1-500, 0.02 )
var nS = {};
for (var ii = 0; ii < STEPS.length; ii++) {
  var step = STEPS[ii];
  nS[step] = mixHex(nPure[step], c1_500, 0.02); // passe à 0.01 si tu veux encore plus subtil
}


  // Chaîne :root{...}
  var parts = [":root{"], i, k;
  for (i=0;i<STEPS.length;i++){ k=STEPS[i]; parts.push("--c1-"+k+":"+c1S[k]+";"); }
  for (i=0;i<STEPS.length;i++){ k=STEPS[i]; parts.push("--c2-"+k+":"+c2S[k]+";"); }
  for (i=0;i<STEPS.length;i++){ k=STEPS[i]; parts.push("--c3-"+k+":"+c3S[k]+";"); }
  for (i=0;i<STEPS.length;i++){ k=STEPS[i]; parts.push("--neutral-"+k+":"+nS[k]+";"); }
  parts.push("}");
  var css = parts.join("");

  return { css: css, c1: c1S, c2: c2S, c3: c3S, neutral: nS };
}

// ---------- Replace variables (collection « 一 Globals ») ----------
function hexToFigmaRGB(hex) {
  var c = hexToRgb(hex);
  return { r: c.r/255, g: c.g/255, b: c.b/255 };
}
function replaceVariablesInCollection(palettes) {
  var collName = "一 Globals";
  var collections = figma.variables.getLocalVariableCollections();
  var coll = null, i;
  for (i=0;i<collections.length;i++) if (collections[i].name === collName) { coll = collections[i]; break; }
  if (!coll) { figma.notify("Collection « 一 Globals » introuvable"); return { updated:0, created:0 }; }

  var modeId = coll.defaultModeId || (coll.modes && coll.modes[0] && coll.modes[0].modeId);
  if (!modeId) { figma.notify("Mode par défaut introuvable"); return { updated:0, created:0 }; }

  function setVar(path, hex) {
    var rgb = hexToFigmaRGB(hex);
    var all = figma.variables.getLocalVariables();
    var v = null, j;
    for (j=0;j<all.length;j++) {
      if (all[j].variableCollectionId === coll.id && all[j].name === path) { v = all[j]; break; }
    }
    if (v) {
      try { v.setValueForMode(modeId, rgb); return { u:1, c:0 }; }
      catch (e) { return { u:0, c:0 }; }
    }
    try {
      var nv = figma.variables.createVariable(path, coll, "COLOR");
      nv.setValueForMode(modeId, rgb);
      return { u:0, c:1 };
    } catch (e) {
      return { u:0, c:0 };
    }
  }

  var updated = 0, created = 0;
  function flush(groupKey, map) {
    var m, res;
    for (m=0;m<STEPS.length;m++){
      var step = STEPS[m];
      res = setVar("colors/" + groupKey + "/" + step, map[step]);
      updated += res.u; created += res.c;
    }
  }
  flush("c1", palettes.c1);
  flush("c2", palettes.c2);
  flush("c3", palettes.c3);
  flush("neutral", palettes.neutral);

  return { updated: updated, created: created };
}

// ---------- IPC UI <-> MAIN ----------
function reply(m){ figma.ui.postMessage(m); }

figma.ui.onmessage = function (msg) {
  try {
    if (msg.type === "GENERATE") {
      var c1 = (msg.payload && msg.payload.c1) || "#000000";
      var c2 = (msg.payload && msg.payload.c2) || "#000000";
      var c3 = (msg.payload && msg.payload.c3) || "#000000";
      var out = buildCssVars(c1, c2, c3);
      figma.notify("neutral-500 (GEN): " + out.neutral[500]);
      reply({ type: "CSS_READY", payload: { css: out.css } });
      return;
    }
    if (msg.type === "REPLACE_VARIABLES") {
      var c1r = (msg.payload && msg.payload.c1) || "#000000";
      var c2r = (msg.payload && msg.payload.c2) || "#000000";
      var c3r = (msg.payload && msg.payload.c3) || "#000000";
      var gen = buildCssVars(c1r, c2r, c3r);
      var s = replaceVariablesInCollection(gen);
      figma.notify("Variables: " + s.updated + " mises à jour, " + s.created + " créées");
      reply({ type: "OK", payload: { note: "Variables remplacées" } });
      return;
    }

    // Compat éventuelle anciens messages
    if (msg.type === "replace-variables") {
      var gen2 = buildCssVars(
        (msg.cssVariables && msg.cssVariables.c1) || "#000000",
        (msg.cssVariables && msg.cssVariables.c2) || "#000000",
        (msg.cssVariables && msg.cssVariables.c3) || "#000000"
      );
      var s2 = replaceVariablesInCollection(gen2);
      figma.notify("Variables: " + s2.updated + " mises à jour, " + s2.created + " créées");
      reply({ type: "OK" });
      return;
    }

    reply({ type: "ERROR", payload: { message: "Unknown message: " + msg.type } });
  } catch (e) {
    reply({ type: "ERROR", payload: { message: String(e && e.message ? e.message : e) } });
  }
};
