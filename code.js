// ===== Figma MAIN (compat ES5) =====
figma.showUI(__html__, { width: 980, height: 660 });

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
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  var r = hue2rgb(p, q, h + 1 / 3), g = hue2rgb(p, q, h), b = hue2rgb(p, q, h - 1 / 3);
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
var STEPS = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
var LIGHTEN = { 25: 0.92, 50: 0.85, 100: 0.75, 200: 0.60, 300: 0.45, 400: 0.30 };
var DARKEN = { 600: 0.16, 700: 0.30, 800: 0.45, 900: 0.60, 950: 0.75 };

function scaleFromBase(baseHex) {
  baseHex = ensureHex(baseHex);
  var scale = { 500: baseHex };
  var white = "#ffffff", black = "#000000", k;
  for (k in LIGHTEN) scale[+k] = mixHex(baseHex, white, LIGHTEN[k]);
  for (k in DARKEN) scale[+k] = mixHex(baseHex, black, DARKEN[k]);
  return scale;
}

// ---------- CSS builder (inclut neutral basé sur C1-500) ----------
function buildCssVars(c1, c2, c3, options) {
  options = options || {};
  var neutralBaseHex = options.neutralBaseHex || null;  // si fourni => neutral manuel
  var tintPct = (options.tintPct != null) ? options.tintPct : 0.02;

  c1 = ensureHex(c1); c2 = ensureHex(c2); c3 = ensureHex(c3);

  var c1S = scaleFromBase(c1);
  var c2S = scaleFromBase(c2);
  var c3S = scaleFromBase(c3);

  // --- Neutral ---
  var grey500 = "#808080";
  var c1_500 = c1S[500];
  var nS = {};
  var baseScale;

  if (neutralBaseHex) {
    // mode "déverrouillé" : neutral = échelle à partir de la base saisie
    baseScale = scaleFromBase(ensureHex(neutralBaseHex));
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      nS[s] = baseScale[s];
    }
  } else {
    // mode par défaut : gris pur teinté max 2% par C1-500
    baseScale = scaleFromBase(grey500);
    for (var j = 0; j < STEPS.length; j++) {
      var st = STEPS[j];
      nS[st] = mixHex(baseScale[st], c1_500, tintPct);
    }
  }

  // Chaîne :root{...}
  var parts = [":root{"], i, k;
  for (i = 0; i < STEPS.length; i++) { k = STEPS[i]; parts.push("--c1-" + k + ":" + c1S[k] + ";"); }
  for (i = 0; i < STEPS.length; i++) { k = STEPS[i]; parts.push("--c2-" + k + ":" + c2S[k] + ";"); }
  for (i = 0; i < STEPS.length; i++) { k = STEPS[i]; parts.push("--c3-" + k + ":" + c3S[k] + ";"); }
  for (i = 0; i < STEPS.length; i++) { k = STEPS[i]; parts.push("--neutral-" + k + ":" + nS[k] + ";"); }
  parts.push("}");
  var css = parts.join("");

  return { css: css, c1: c1S, c2: c2S, c3: c3S, neutral: nS };
}


// ---------- Replace variables (collection « 一 Globals ») ----------
function hexToFigmaRGB(hex) {
  var c = hexToRgb(hex);
  return { r: c.r / 255, g: c.g / 255, b: c.b / 255 };
}

// Convertit #rrggbb -> {r:0..1,g:0..1,b:0..1}
function hexToRGB01(hex) {
  var c = hexToRgb(hex);
  return { r: c.r / 255, g: c.g / 255, b: c.b / 255 };
}

// Noir ou Blanc le plus lisible sur un fond donné
function bestOnHex(bg) {
  var rB = contrastRatioHex(bg, "#000000");
  var rW = contrastRatioHex(bg, "#ffffff");
  return (rB >= rW) ? "#000000" : "#ffffff";
}
// Fonction pour créer un texte dans Figma
function createTextNode(text, fontSize, color) {
  var textNode = figma.createText();
  textNode.characters = text;
  textNode.fontSize = fontSize || 14;
  textNode.fills = [{ type: "SOLID", color: hexToFigmaRGB(color || "#000000") }];
  return textNode;
}

// Fonction pour créer un rectangle coloré
function createColorSwatch(color, width, height) {
  var rect = figma.createRectangle();
  rect.resize(width || 60, height || 60);
  rect.fills = [{ type: "SOLID", color: hexToFigmaRGB(color) }];
  rect.cornerRadius = 8;
  return rect;
}
function replaceVariablesInCollection(palettes) {
  var collName = "一 Globals";
  var collections = figma.variables.getLocalVariableCollections();
  var coll = null, i;
  for (i = 0; i < collections.length; i++) if (collections[i].name === collName) { coll = collections[i]; break; }
  if (!coll) { figma.notify("Collection « 一 Globals » introuvable"); return { updated: 0, created: 0 }; }

  var modeId = coll.defaultModeId || (coll.modes && coll.modes[0] && coll.modes[0].modeId);
  if (!modeId) { figma.notify("Mode par défaut introuvable"); return { updated: 0, created: 0 }; }

  function setVar(path, hex) {
    var rgb = hexToFigmaRGB(hex);
    var all = figma.variables.getLocalVariables();
    var v = null, j;
    for (j = 0; j < all.length; j++) {
      if (all[j].variableCollectionId === coll.id && all[j].name === path) { v = all[j]; break; }
    }
    if (v) {
      try { v.setValueForMode(modeId, rgb); return { u: 1, c: 0 }; }
      catch (e) { return { u: 0, c: 0 }; }
    }
    try {
      var nv = figma.variables.createVariable(path, coll, "COLOR");
      nv.setValueForMode(modeId, rgb);
      return { u: 0, c: 1 };
    } catch (e) {
      return { u: 0, c: 0 };
    }
  }

  var updated = 0, created = 0;
  function flush(groupKey, map) {
    var m, res;
    for (m = 0; m < STEPS.length; m++) {
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


// --- version compatible dynamic-page (Async)
async function findTextStyleIdByNames(candidates) {
  var styles = await figma.getLocalTextStylesAsync(); // << important
  // 1) match exact
  for (var i = 0; i < candidates.length; i++) {
    for (var j = 0; j < styles.length; j++) {
      if (styles[j].name === candidates[i]) return styles[j].id;
    }
  }
  // 2) match suffixe
  for (var k = 0; k < candidates.length; k++) {
    for (var m = 0; m < styles.length; m++) {
      if (styles[m].name.slice(-candidates[k].length) === candidates[k]) return styles[m].id;
    }
  }
  return null;
}

// ---- OVERWRITE ONLY in collection "一 Globals" (ES5 & dynamic-page safe)
function overwriteGlobalsColorsAsync(gen) {
  // Normalise un nom: retire les espaces autour des "/" et passe en minuscule
  function norm(name) {
    return String(name || "")
      .replace(/\s*\/\s*/g, "/")
      .trim()
      .toLowerCase();
  }
  function keyFor(prefix, step) {
    return norm("colors/" + prefix + "/" + String(step));
  }
  function ensureHexLocal(hex) {
    try {
      return (typeof ensureHex === "function") ? ensureHex(hex) : (hex || "#000000");
    } catch (e) {
      return hex || "#000000";
    }
  }
  function hexToRGB01(hex) {
    hex = ensureHexLocal(hex);
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return { r: r / 255, g: g / 255, b: b / 255 };
  }

  // 1) Trouver la collection "一 Globals"
  return figma.variables.getLocalVariableCollectionsAsync().then(function (cols) {
    var col = null;
    for (var i = 0; i < cols.length; i++) {
      var nm = cols[i].name;
      if (nm === "一 Globals" || nm === "Globals") { col = cols[i]; break; }
    }
    if (!col) {
      figma.notify('Collection "一 Globals" introuvable. Ouvre-la et relance.', { error: true });
      return { updated: 0, missing: 0, noCollection: true };
    }

    // 2) Indexer toutes les variables de CETTE collection
    return figma.variables.getLocalVariablesAsync().then(function (all) {
      var index = {}; // clé normalisée -> Variable
      for (var j = 0; j < all.length; j++) {
        var v = all[j];
        if (v.variableCollectionId !== col.id) continue;
        if (v.resolvedType !== "COLOR") continue;
        index[norm(v.name)] = v;
      }

      // 3) Mise à jour sans création
      var modeId = col.defaultModeId;
      var updated = 0, missing = 0;

      function updateScale(prefix, scale) {
        for (var k in scale) if (scale.hasOwnProperty(k)) {
          var key = keyFor(prefix, k);
          var varNode = index[key];
          if (varNode) {
            varNode.setValueForMode(modeId, hexToRGB01(scale[k]));
            updated++;
          } else {
            // on NE crée PAS — on compte ce qui manque
            missing++;
          }
        }
      }

      updateScale("c1", gen.c1);
      updateScale("c2", gen.c2);
      updateScale("c3", gen.c3);
      updateScale("neutral", gen.neutral);

      return { updated: updated, missing: missing };
    });
  });
}

function _loadFontForStyleId(styleId) {
  try {
    var st = figma.getStyleById(styleId);
    if (st && st.type === "TEXT" && st.fontName) {
      return figma.loadFontAsync(st.fontName);
    }
  } catch (e) { }
  // fallback Inter Regular
  return figma.loadFontAsync({ family: "Inter", style: "Regular" });
}

function createTextWithStyle(text, styleId) {
  var t = figma.createText();
  if (styleId) {
    try {
      t.textStyleId = styleId;
    } catch (e) { }
  }
  t.characters = text || "";
  return t;
}

// --- Helper: récupère l'ID de variable "一 Globals/colors/{brand}/{step}" (ES5 + dynamic-page)
function resolveGlobalsColorVarIdAsync(brandKey, step) {
  return figma.variables.getLocalVariableCollectionsAsync().then(function (cols) {
    var i, targetCol = null;
    for (i = 0; i < cols.length; i++) {
      if (cols[i].name === "一 Globals") { targetCol = cols[i]; break; }
    }
    if (!targetCol) { return null; }

    // Variables de cette collection
    // (suivant la version du SDK, l'une ou l'autre API peut être dispo)
    var vars = [];
    if (figma.variables.getLocalVariablesByCollectionId) {
      vars = figma.variables.getLocalVariablesByCollectionId(targetCol.id);
      return findVarIdIn(vars);
    }

    // Fallback asynchrone si besoin
    if (figma.variables.getLocalVariablesByCollectionIdAsync) {
      return figma.variables.getLocalVariablesByCollectionIdAsync(targetCol.id).then(findVarIdIn);
    }

    return null;

    function findVarIdIn(list) {
      var k, name = "colors/" + String(brandKey) + "/" + String(step);
      for (k = 0; k < list.length; k++) {
        if (list[k].name === name) { return list[k].id; }
      }
      return null;
    }
  });
}

// ---Helper: Résout la Variable (objet) "一 Globals/colors/{brandKey}/{step}" en ES5 + dynamic-page
function resolveGlobalsColorVariableAsync(brandKey, step) {
  var target = "colors/" + String(brandKey) + "/" + String(step);
  // 1) Trouver la collection "一 Globals"
  return figma.variables.getLocalVariableCollectionsAsync().then(function (cols) {
    var col = null, i;
    for (i = 0; i < cols.length; i++) {
      if (cols[i].name === "一 Globals") { col = cols[i]; break; }
    }
    if (!col) return null;
    // 2) Chercher la variable par chemin dans cette collection
    return figma.variables.getLocalVariablesAsync().then(function (vars) {
      var cleanedTarget = target.replace(/\s+/g, "");
      for (i = 0; i < vars.length; i++) {
        var v = vars[i];
        if (v.variableCollectionId !== col.id) continue;
        // Les noms de variables incluent le chemin "colors/c1/500"
        var cleanedName = String(v.name || "").replace(/\s+/g, "");
        if (cleanedName === cleanedTarget) return v; // <- retourne l'OBJET Variable
      }
      return null;
    });
  });
}

// --- Helper: applique un fill aliasé sur une frame (si la variable existe)
function bindFillToColorVariableAsync(node, brandKey, step) {
  return resolveGlobalsColorVariableAsync(brandKey, step).then(function (variable) {
    if (!variable) return; // pas de variable trouvée => on ne change rien
    var p = { type: "SOLID", color: { r: 1, g: 1, b: 1 } };
    // ✅ Figma attend un VariableAlias: { type: "VARIABLE_ALIAS", id: <variableId> }
    p.boundVariables = { color: { type: "VARIABLE_ALIAS", id: variable.id } };
    node.fills = [p];
  });
}

// --- Vars helpers (cache) ---
var __globalsCollectionId = null;
function getGlobalsCollectionAsync() {
  if (__globalsCollectionId) {
    return Promise.resolve(figma.variables.getVariableCollectionById(__globalsCollectionId));
  }
  return figma.variables.getLocalVariableCollectionsAsync().then(function (cols) {
    for (var i = 0; i < cols.length; i++) {
      if (cols[i].name && cols[i].name.indexOf("一 Globals") === 0) {
        __globalsCollectionId = cols[i].id;
        return cols[i];
      }
    }
    return null;
  });
}
 // Cherche l’ID d’une variable « 一 Globals » par chemin normalisé (ES5 + dynamic-page)
 function findVarIdInGlobalsAsync(path) {
   function norm(s){ return String(s||"").replace(/\s*\/\s*/g,"/").trim().toLowerCase(); }
   var target = norm(path);
   return getGlobalsCollectionAsync().then(function(col){
     if(!col) return null;
     return figma.variables.getLocalVariablesAsync().then(function(vars){
       for(var i=0;i<vars.length;i++){
         var v = vars[i];
         if(v.variableCollectionId !== col.id) continue;
         if(norm(v.name) === target) return v.id;
       }
       return null;
     });
   });
 }

 // Lie la paint d’un node à une variable par ID (Variable Alias)
 function bindPaintToVarId(node, varId){
   if(!varId) return;
   try{
     var fills = node.fills;
     if(!fills || !fills.length) fills = [{ type:"SOLID", color:{r:1,g:1,b:1}, opacity:1 }];
     var p = fills[0];
     if(p.type !== "SOLID") p = { type:"SOLID", color:{r:1,g:1,b:1}, opacity:(p.opacity!=null?p.opacity:1) };
     p.boundVariables = { color:{ type:"VARIABLE_ALIAS", id:varId } };
     node.fills = [p];
   }catch(e){}
 }


 function findVarIdInGlobalsAsync(path) {
   // Normalise : retire espaces autour des “/”, trim, toLowerCase (comme dans overwriteGlobalsColorsAsync)
   function norm(s) { return String(s || "").replace(/\s*\/\s*/g, "/").trim().toLowerCase(); }
   var target = norm(path);
   return getGlobalsCollectionAsync().then(function (col) {
     if (!col) return null;
     return figma.variables.getLocalVariablesAsync().then(function (vars) {
       for (var i = 0; i < vars.length; i++) {
         var v = vars[i];
         if (v.variableCollectionId !== col.id) continue;
         if (norm(v.name) === target) return v.id; // ← comparaison normalisée
       }
       return null;
     });
   });
 }
function bindPaintToVarId(node, varId) {
  if (!varId) return;
  try {
    var fills = node.fills;
    if (!fills || !fills.length) {
      // crée une paint si besoin (garde l’opacité par défaut à 1)
      fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
    }
    var p = fills[0];
    if (p.type !== "SOLID") {
      p = { type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: (p.opacity != null ? p.opacity : 1) };
    }
    // ✅ clé: lier la couleur via un Variable Alias sur la paint
    p.boundVariables = { color: { type: "VARIABLE_ALIAS", id: varId } };
    node.fills = [p];
  } catch (e) { }
}




// --- Capsule WCAG "◈ T ☰" (ES5 + Auto-layout) ---
function createA11yPillNode(bgHex, styles) {
  var rB = contrastRatioHex(bgHex, "#000000");
  var rW = contrastRatioHex(bgHex, "#ffffff");

  // seuils (mêmes que dans l'UI React)
  function passG(r) { return r >= 3.0 }   // Graphismes / UI
  function passT(r) { return r >= 3.0 }   // Texte large
  function passN(r) { return r >= 4.5 }   // Texte normal

  // conteneur capsule
  var pill = figma.createFrame();
  pill.name = "A11yPill";
  pill.layoutMode = "HORIZONTAL";
  pill.primaryAxisSizingMode = "AUTO";
  pill.counterAxisSizingMode = "AUTO";
  pill.itemSpacing = 4;
  pill.paddingLeft = pill.paddingRight = 4;
  pill.paddingTop = pill.paddingBottom = 2;
  pill.cornerRadius = 16;
  pill.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.35 }];
  pill.strokes = [];

  function side(isBlack) {
    var f = figma.createFrame();
    f.layoutMode = "HORIZONTAL";
    f.primaryAxisSizingMode = "AUTO";
    f.counterAxisSizingMode = "AUTO";
    f.itemSpacing = 2;
    f.paddingLeft = f.paddingRight = 0;
    f.paddingTop = f.paddingBottom = 0;
    f.fills = [];
    // ratio en 10px (style infoXSmall si dispo)
    var ratio = createTextWithStyle((isBlack ? rB : rW).toFixed(2), styles.infoXSmall);
    ratio.fontSize = 10;
    // Fallback direct (pour l’aperçu immédiat)
    ratio.fills = [{ type: "SOLID", color: isBlack ? { r: 0, g: 0, b: 0 } : { r: 1, g: 1, b: 1 } }];
    // Bind sur variable — noir = neutral/1000, blanc = neutral/000
    findVarIdInGlobalsAsync(isBlack ? "colors/neutral/1000" : "colors/neutral/000").then(function(varId){
      bindPaintToVarId(ratio, varId);
    });

    function ic(txt, ok) {
      var t = createTextWithStyle(txt, styles.infoXSmall);
      t.fontSize = 10;
    // Fallback direct (vert/rouge) pour l’aperçu
      t.fills = [{
        type: "SOLID",
        color: ok ? { r: 0.094, g: 0.541, b: 0.353 } : { r: 0.827, g: 0.329, b: 0.329 }
      }];
      // Bind sur variables de signal : level1 (ok) / level3 (ko)
      findVarIdInGlobalsAsync(ok ? "colors/signal/level1" : "colors/signal/level3").then(function(varId){
        bindPaintToVarId(t, varId);
      });
      return t;
    }

    var r = isBlack ? rB : rW;
    f.appendChild(ratio);
    f.appendChild(ic("◈", passG(r)));
    f.appendChild(ic("T", passT(r)));
    f.appendChild(ic("☰", passN(r)));
    return f;
  }

  pill.appendChild(side(true));   // noir
  pill.appendChild(side(false));  // blanc

  return pill;
}

function makeRow(step, hex, styles, brandKey) {
  var bg = ensureHex(hex);
  var fg = bestOnHex(bg);

  // Conteneur principal
  var row = figma.createFrame();
  row.name = "Row";
  row.layoutMode = "VERTICAL";
  row.primaryAxisSizingMode = "AUTO"; // Hug height
  row.counterAxisSizingMode = "AUTO"; // Hug width, parent col imposera Fill
  row.itemSpacing = 0;
  row.paddingLeft = row.paddingRight = 0;
  row.paddingTop = row.paddingBottom = 0;
  row.fills = [{ type: "SOLID", color: hexToRGB01(bg) }];

  // Frame interne (contenu de la ligne)
  var inner = figma.createFrame();
  inner.name = "RowContent";
  inner.layoutMode = "HORIZONTAL";
  inner.primaryAxisSizingMode = "AUTO";
  inner.counterAxisSizingMode = "AUTO";
  inner.primaryAxisAlignItems = "SPACE_BETWEEN";
  inner.counterAxisAlignItems = "CENTER";
  inner.itemSpacing = 0;
  inner.paddingLeft = inner.paddingRight = 16;
  inner.paddingTop = inner.paddingBottom = 12;
  inner.fills = [];

  // Textes
  var stepTxt = createTextWithStyle(String(step), styles.bold);
  var hexTxt = createTextWithStyle(bg.toUpperCase(), styles.infoSmall);
  var pill = createA11yPillNode(bg, styles);

  var fillFg = { type: "SOLID", color: hexToRGB01(fg) };
  stepTxt.fills = [fillFg];
  hexTxt.fills = [fillFg];
    // Binde le texte sur la bonne variable neutral (noir ou blanc)
  findVarIdInGlobalsAsync(fg === "#000000" ? "colors/neutral/1000" : "colors/neutral/000")
    .then(function(varId){
      bindPaintToVarId(stepTxt, varId);
      bindPaintToVarId(hexTxt, varId);
    });

  stepTxt.textAlignVertical = "CENTER";
  hexTxt.textAlignVertical = "CENTER";

  inner.appendChild(stepTxt);
  inner.appendChild(pill);
  inner.appendChild(hexTxt);

  row.appendChild(inner);
  // --- Rebind du fond sur la variable: 一 Globals/colors/{brandKey}/{step}
  bindFillToColorVariableAsync(row, brandKey, step);

  // ✅ appliquer Fill/Hug APRES append
  inner.layoutSizingHorizontal = "FILL";
  inner.layoutSizingVertical = "HUG";

  return row;
}

function contrastRatioHex(aHex, bHex) {
  function srgbToLin(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function relLum(hex) {
    hex = ensureHex(hex);
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255,
      g = (n >> 8) & 255,
      b = n & 255;
    var R = srgbToLin(r),
      G = srgbToLin(g),
      B = srgbToLin(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }
  var L1 = relLum(aHex),
    L2 = relLum(bHex);
  var hi = Math.max(L1, L2),
    lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}


async function generatePaletteFrames(gen, names) {
  var normalId = await findTextStyleIdByNames(["Body/Standard/Normal", "Body/Standard/Regular", "Normal"]);
  var boldId = await findTextStyleIdByNames(["Body/Standard/Bold", "Bold"]);
  var infoSmallId = await findTextStyleIdByNames(["infos-styles/infos-small", "infos-small"]);
  var infoXSmallId = await findTextStyleIdByNames(["infos-styles/infos-xsmall", "infos-xsmall"]);

  await _loadFontForStyleId(normalId);
  await _loadFontForStyleId(boldId);
  await _loadFontForStyleId(infoSmallId);
  await _loadFontForStyleId(infoXSmallId);

  var styles = { normal: normalId, bold: boldId, infoSmall: infoSmallId, infoXSmall: infoXSmallId };

  var root = figma.createFrame();
  root.name = "Palettes";
  root.layoutMode = "HORIZONTAL";
  root.primaryAxisSizingMode = "AUTO";
  root.counterAxisSizingMode = "AUTO";
  root.itemSpacing = 24;
  root.paddingLeft = root.paddingRight = 24;
  root.paddingTop = root.paddingBottom = 24;
  root.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  root.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.06 }];
  root.cornerRadius = 12;

  function makeColumn(title, baseHex, scale, brandKey) {
    var col = figma.createFrame();
    col.name = title;
    col.layoutMode = "VERTICAL";
    col.primaryAxisSizingMode = "AUTO";
    col.counterAxisSizingMode = "FIXED";
    col.resize(360, col.height);
    col.itemSpacing = 0;
    col.paddingLeft = col.paddingRight = 16;
    col.paddingTop = col.paddingBottom = 16;
    col.cornerRadius = 16;
    col.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.08 }];
    col.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

    // Header
    var header = figma.createFrame();
    header.name = "Header";
    header.layoutMode = "VERTICAL";
    header.primaryAxisSizingMode = "AUTO";
    header.counterAxisSizingMode = "AUTO";
    header.itemSpacing = 0;
    header.paddingLeft = header.paddingRight = 0;
    header.paddingTop = header.paddingBottom = 0;
    header.cornerRadius = 0;

    // couleur 500 de la colonne
    var base = ensureHex(scale["500"] || baseHex);
    header.fills = [{ type: "SOLID", color: hexToRGB01(base) }];

    // Contenu du header (transparent !)
    var headerContent = figma.createFrame();
    headerContent.name = "HeaderContent";
    headerContent.layoutMode = "HORIZONTAL";
    headerContent.primaryAxisSizingMode = "AUTO";
    headerContent.counterAxisSizingMode = "AUTO";
    headerContent.primaryAxisAlignItems = "SPACE_BETWEEN";
    headerContent.counterAxisAlignItems = "CENTER";
    headerContent.itemSpacing = 12;
    headerContent.paddingLeft = headerContent.paddingRight = 16;
    headerContent.paddingTop = headerContent.paddingBottom = 16;
    headerContent.fills = [];               // <<— important : pas de fond
    headerContent.strokes = [];

    // Texte noir/blanc selon le contraste sur la 500
    var rBHead = contrastRatioHex(base, "#000000");
    var rWHead = contrastRatioHex(base, "#ffffff");
    var headFg = (rBHead >= rWHead) ? { r: 0, g: 0, b: 0 } : { r: 1, g: 1, b: 1 };

        // Binde les textes du header sur neutral/1000 ou neutral/000 selon le contraste
    findVarIdInGlobalsAsync((headFg && headFg.r === 0) ? "colors/neutral/1000" : "colors/neutral/000")
      .then(function(varId){
        bindPaintToVarId(t, varId);
        bindPaintToVarId(code, varId);
      });

    var t = createTextWithStyle(title, styles.bold);
    var code = createTextWithStyle(ensureHex(base).toUpperCase(), styles.infoSmall);
    t.fills = [{ type: "SOLID", color: headFg }];
    code.fills = [{ type: "SOLID", color: headFg }];
    t.textAlignVertical = "CENTER";
    code.textAlignVertical = "CENTER";

    headerContent.appendChild(t);
    headerContent.appendChild(code);
    header.appendChild(headerContent);
    col.appendChild(header);
    // --- Rebind du fond du header sur la variable 500 de la marque
    bindFillToColorVariableAsync(header, brandKey, 500);

    // sizing après append (si tu gardes cette convention)
    header.layoutSizingHorizontal = "FILL";
    header.layoutSizingVertical = "HUG";
    headerContent.layoutSizingHorizontal = "FILL";
    headerContent.layoutSizingVertical = "HUG";

    // Lignes
    var steps = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var hex = scale[String(s)] || "#eeeeee";
      var row = makeRow(s, hex, styles, brandKey);
      col.appendChild(row);

      // ✅ après append
      row.layoutSizingHorizontal = "FILL";
      row.layoutSizingVertical = "HUG";
    }

    return col;
  }

  root.appendChild(makeColumn(names.c1 || "Brand C1", gen.c1[500], gen.c1, "c1"));
  root.appendChild(makeColumn(names.c2 || "Brand C2", gen.c2[500], gen.c2, "c2"));
  root.appendChild(makeColumn(names.c3 || "Brand C3", gen.c3[500], gen.c3, "c3"));
  root.appendChild(makeColumn(names.neutral || "Brand Neutral", gen.neutral[500], gen.neutral, "neutral"));

  var c = figma.viewport.center;
  root.x = Math.round(c.x - root.width / 2);
  root.y = Math.round(c.y - root.height / 2);

  figma.currentPage.selection = [root];
  figma.notify("Frames générées ✔︎");
}

// ---------- IPC UI <-> MAIN ----------
function reply(m) { figma.ui.postMessage(m); }

figma.ui.onmessage = function (msg) {
  try {
    if (msg.type === "GENERATE") {
      var c1 = (msg.payload && msg.payload.c1) || "#000000";
      var c2 = (msg.payload && msg.payload.c2) || "#000000";
      var c3 = (msg.payload && msg.payload.c3) || "#000000";

      var neutralUnlocked = !!(msg.payload && msg.payload.neutralUnlocked === true);
      var neutralManual = (msg.payload && msg.payload.neutralManual) || null;

      var out = buildCssVars(c1, c2, c3, {
        neutralBaseHex: (neutralUnlocked && neutralManual) ? ensureHex(neutralManual) : null
      });

      figma.notify("neutral-500 (GEN): " + out.neutral[500]);
      reply({ type: "CSS_READY", payload: { css: out.css } });
      return;
    }

    /* Ci-dessus la version qui marche en local, en ci-dessous celle que devrait marcher publiée*/
    if (msg.type === "REPLACE_VARIABLES") {
      var c1r = (msg.payload && msg.payload.c1) || "#000000";
      var c2r = (msg.payload && msg.payload.c2) || "#000000";
      var c3r = (msg.payload && msg.payload.c3) || "#000000";

      var neutralUnlocked = !!(msg.payload && msg.payload.neutralUnlocked === true);
      var neutralManual = (msg.payload && msg.payload.neutralManual) || null;

      var gen = buildCssVars(c1r, c2r, c3r, {
        neutralBaseHex: (neutralUnlocked && neutralManual) ? ensureHex(neutralManual) : null
      });

      overwriteGlobalsColorsAsync(gen).then(function (res) {
        if (res && res.noCollection) return; // déjà notifié
        var msgTxt = "Variables mises à jour : " + res.updated;
        if (res.missing > 0) msgTxt += " · introuvables : " + res.missing + " (non créées)";
        figma.notify(msgTxt);
        reply({ type: "OK", payload: res });
      }).catch(function (err) {
        figma.notify("Replace failed: " + (err && err.message ? err.message : String(err)), { error: true });
      });
      return;
    }

    if (msg.type === "GENERATE_FRAMES") {
      // Demander l'accès à la page avant de créer les frames
      figma.skipInvisibleInstanceChildren = true;

      // Vérifier si on a déjà accès à la page
      if (figma.currentPage) {
        // On a accès, on peut générer
        var c1g = (msg.payload && msg.payload.c1) || "#000000";
        var c2g = (msg.payload && msg.payload.c2) || "#000000";
        var c3g = (msg.payload && msg.payload.c3) || "#000000";

        var neutralUnlocked = !!(msg.payload && msg.payload.neutralUnlocked === true);
        var neutralManual = (msg.payload && msg.payload.neutralManual) || null;

        var gen = buildCssVars(c1g, c2g, c3g, {
          neutralBaseHex: (neutralUnlocked && neutralManual) ? ensureHex(neutralManual) : null
        });

        generatePaletteFrames(gen, {
          c1: "Brand C1",
          c2: "Brand C2",
          c3: "Brand C3",
          neutral: "Brand Neutral"
        });
      } else {
        figma.notify("Impossible d'accéder à la page");
      }

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
