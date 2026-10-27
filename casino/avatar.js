/* =====================================================================
   קזינו המאוחדת — דמויות: מחולל דמות וקטורית עם כובעים, תחפושות,
   עיצוב פנים מלא ואפשרות לשים את התמונה של שחקן מהאתר במקום הפנים.
   ===================================================================== */
(function () {
  const C = window.Casino;
  const { read, write } = C.store;
  const PKEY = "hmh-casino-profile-v1";
  /* שם החשבון ב-Cloudinary של האתר (TEAM.cloudinary.cloudName ב-index.html) */
  const CLOUD = "mrobhtey";
  const PHOTO_PREFIX = `https://res.cloudinary.com/${CLOUD}/image/upload/`;
  /* זיהוי הפנים האוטומטי נופל על חלק מהתמונות (תופס את הסמל שעל החולצה), וכל תמונות
     הסגל צולמו באותו פורמט — הראש תמיד באמצע למעלה. לכן חותכים קבוע. */
  const FACE_CROP = "c_crop,g_north,w_0.46,h_0.36,y_0.02/c_fill,w_160,h_180";
  const OLD_CROP = "c_thumb,g_face,w_160,h_180,z_0.75";

  C.LOOK = {
    skin: ["#f7d7bb", "#ecbf98", "#d8a074", "#b07448", "#82512f", "#583520", "#9ad17a", "#8fb8ff"],
    hair: ["#16100e", "#3b2416", "#6b3f1f", "#a8652a", "#dcb760", "#c9c4bd", "#f4f1ea", "#b3262e", "#2f6fdb", "#e05ab8", "#7c4dff", "#1d7a4a"],
    top: ["#c0263a", "#1f4fa8", "#1d7a4a", "#6c2b8f", "#e6b647", "#222428", "#e8742c", "#0e7c86", "#f1ede6", "#d1477a", "#5b3a1e", "#7fd3ff"],
    bottom: ["#23252b", "#2c3e66", "#4a3b2a", "#1b1b1b", "#5b5e66", "#f1ede6", "#8b1a2b", "#1d7a4a"],
    acc: ["#b3262e", "#e6b647", "#1f4fa8", "#111111", "#1d7a4a", "#e05ab8", "#f1ede6", "#7c4dff"],
    eye: ["#3b2416", "#1f6fb3", "#2e8b57", "#6b6b6b", "#8b5a2b", "#7c4dff"],
    lips: ["#8a3b31", "#c2185b", "#e53935", "#7b1fa2", "#3b2416"],
    hatc: ["#222428", "#b3262e", "#1f4fa8", "#e6b647", "#1d7a4a", "#f1ede6", "#e05ab8", "#5b3a1e"],
    hs: ["קצר", "ארוך", "קוקו", "קירח", "מתולתל", "זנב סוס", "מוהוק", "אפרו", "קוצים", "קארה", "צמות"],
    outfit: {
      shirt: "👕 חולצה",
      suit: "👔 חליפה",
      dress: "👗 שמלה",
      jersey: "⚽ חולצת המאוחדת",
      hoodie: "🧥 קפוצ׳ון",
      tux: "🤵 טוקסידו",
      hero: "🦸 גיבור־על",
      pirate: "🏴‍☠️ פיראט",
      wizard: "🧙 קוסם",
      hawaii: "🌺 הוואי",
      chef: "👨‍🍳 שף",
      king: "🤴 מלך",
    },
    hat: {
      none: "בלי",
      cap: "🧢 מצחייה",
      top: "🎩 צילינדר",
      cowboy: "🤠 קאובוי",
      crown: "👑 כתר",
      beanie: "🧶 גרב",
      party: "🥳 מסיבה",
      chef: "👨‍🍳 שף",
      viking: "⚔️ ויקינג",
      wizard: "🧙 קוסם",
      pirate: "🏴‍☠️ פיראט",
      halo: "😇 הילה",
      horns: "😈 קרניים",
      band: "🎽 סרט ספורט",
      bunny: "🐰 אוזני ארנב",
    },
    eyes: { normal: "רגילות", big: "גדולות", happy: "שמחות", wink: "קריצה", sleepy: "ישנוניות", angry: "כועסות", hearts: "😍 לבבות", stars: "🤩 כוכבים" },
    brows: { normal: "רגילות", thick: "עבות", raised: "מורמות", angry: "כועסות", none: "בלי" },
    nose: { small: "קטן", round: "עגול", big: "גדול" },
    mouth: { smile: "חיוך", grin: "שיניים", laugh: "צחוק", smirk: "עקום", neutral: "רציני", tongue: "😛 לשון", wow: "😮 מופתע", sad: "עצוב" },
    facial: { none: "בלי", beard: "זקן", goatee: "זקנקן", mustache: "שפם", handlebar: "שפם מסולסל", stubble: "זיפים" },
    glasses: { none: "בלי", reg: "👓 משקפיים", sun: "🕶️ שמש", round: "עגולים", star: "⭐ כוכבים", patch: "🏴‍☠️ רטייה", mono: "🧐 מונוקל", vr: "🎞️ תלת־ממד" },
    item: { none: "בלי", beer: "🍺 בירה", drink: "🍹 קוקטייל", trophy: "🏆 גביע", ball: "⚽ כדור", flag: "🚩 דגל", mic: "🎤 מיקרופון", rose: "🌹 ורד", chips: "🪙 צ'יפים" },
  };

  const HEX = /^#[0-9a-f]{3,8}$/i;
  const hex = (v, d) => (HEX.test(v) ? v : d);
  const key = (obj, v, d) => (typeof v === "string" && Object.hasOwn(obj, v) ? v : d);
  const okPhoto = (u) => typeof u === "string" && u.length < 400 && u.startsWith(PHOTO_PREFIX) && /^[\w\-./:,%]+$/.test(u);

  C.cleanLook = (L = {}) => {
    const K = C.LOOK;
    return {
      skin: hex(L.skin, K.skin[1]),
      hair: hex(L.hair, K.hair[0]),
      top: hex(L.top, K.top[0]),
      bottom: hex(L.bottom, "#23252b"),
      acc: hex(L.acc, "#b3262e"),
      eye: hex(L.eye, K.eye[0]),
      lips: hex(L.lips, K.lips[0]),
      hatc: hex(L.hatc, K.hatc[0]),
      hs: C.clamp(Math.floor(+L.hs || 0), 0, K.hs.length - 1),
      outfit: key(K.outfit, L.outfit, "shirt"),
      hat: key(K.hat, L.hat, "none"),
      eyes: key(K.eyes, L.eyes, "normal"),
      brows: key(K.brows, L.brows, "normal"),
      nose: key(K.nose, L.nose, "small"),
      mouth: key(K.mouth, L.mouth, "smile"),
      facial: key(K.facial, L.facial ?? (L.beard ? "beard" : "none"), "none"),
      glasses: key(K.glasses, L.glasses, "none"),
      item: key(K.item, L.item, "none"),
      blush: !!L.blush,
      freckles: !!L.freckles,
      earrings: !!L.earrings,
      num: C.clamp(Math.floor(+(L.num ?? 10) || 0), 0, 99),
      photo: okPhoto(L.photo) ? L.photo.replace(OLD_CROP, FACE_CROP) : "",
      kind: ["guest", "dealer", "waitress", "bartender"].includes(L.kind) ? L.kind : "guest",
    };
  };

  C.randomLook = (rnd = Math.random, wild = false) => {
    const K = C.LOOK;
    const p = (a) => C.pick(a, rnd);
    const keys = (o) => Object.keys(o);
    const outfit = wild ? p(keys(K.outfit)) : p(["suit", "shirt", "dress", "suit", "shirt", "jersey", "hoodie", "hawaii"]);
    const fem = outfit === "dress" || rnd() < 0.35;
    return C.cleanLook({
      skin: p(wild ? K.skin : K.skin.slice(0, 6)),
      hair: p(wild ? K.hair : K.hair.slice(0, 7)),
      top: p(K.top),
      bottom: p(K.bottom),
      acc: p(K.acc),
      eye: p(K.eye),
      lips: fem ? p(K.lips) : K.lips[0],
      hatc: p(K.hatc),
      hs: fem ? p([1, 2, 5, 4, 9, 10, 7]) : p([0, 0, 3, 4, 0, 6, 7, 8]),
      outfit,
      hat: wild || rnd() < 0.25 ? p(keys(K.hat)) : "none",
      eyes: rnd() < 0.7 ? "normal" : p(keys(K.eyes)),
      brows: p(["normal", "normal", "thick", "raised"]),
      nose: p(keys(K.nose)),
      mouth: rnd() < 0.5 ? "smile" : p(keys(K.mouth)),
      facial: !fem && rnd() < 0.35 ? p(keys(K.facial).slice(1)) : "none",
      glasses: rnd() < (wild ? 0.6 : 0.2) ? p(keys(K.glasses).slice(1)) : "none",
      item: wild ? p(keys(K.item)) : rnd() < 0.15 ? p(["drink", "chips", "drink"]) : "none",
      blush: rnd() < 0.3,
      freckles: rnd() < 0.15,
      earrings: fem && rnd() < 0.5,
      num: Math.floor(rnd() * 99) + 1,
    });
  };

  C.profile = {
    get() {
      const p = read(PKEY, null);
      return p ? { name: String(p.name || "אורח").slice(0, 16), look: C.cleanLook(p.look) } : null;
    },
    set(p) {
      write(PKEY, { name: String(p.name).slice(0, 16), look: C.cleanLook(p.look) });
    },
  };

  const shade = (h0, amt) => {
    let h = h0.slice(1);
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    const f = (v) => C.clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255);
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
  };
  C.shade = shade;
  const star = (cx, cy, r, fill) => {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(2) + " " + (cy + Math.sin(a) * rr).toFixed(2);
    }
    return `<path d="${d}Z" fill="${fill}"/>`;
  };
  const heart = (cx, cy, s, fill) =>
    `<path d="M${cx} ${cy + s * 0.9}C${cx - s * 1.6} ${cy - s * 0.2} ${cx - s * 0.7} ${cy - s * 1.4} ${cx} ${cy - s * 0.4}C${cx + s * 0.7} ${cy - s * 1.4} ${cx + s * 1.6} ${cy - s * 0.2} ${cx} ${cy + s * 0.9}Z" fill="${fill}"/>`;

  /* ===================== החלקים של הפנים ===================== */
  const EL = [27.3, 29];
  const ER = [36.7, 29];
  function eyesSVG(L, blink) {
    const sk = L.skin;
    const one = ([x, y], kind) => {
      if (kind === "happy") return `<path d="M${x - 2.3} ${y + 0.8}Q${x} ${y - 2.2} ${x + 2.3} ${y + 0.8}" stroke="#1b1414" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
      if (kind === "hearts") return heart(x, y, 2.2, "#e53950");
      if (kind === "stars") return star(x, y, 2.8, "#ffcf3a");
      const big = kind === "big";
      const rx = big ? 2.9 : 2.3;
      const ry = big ? 3 : 2.1;
      let s = `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff"/>
<circle cx="${x}" cy="${y + 0.2}" r="${big ? 1.9 : 1.45}" fill="${L.eye}"/><circle cx="${x}" cy="${y + 0.2}" r="${big ? 1 : 0.75}" fill="#0b0808"/>
<circle cx="${x + 0.6}" cy="${y - 0.5}" r="${big ? 0.7 : 0.5}" fill="#fff"/>`;
      if (kind === "sleepy") s += `<path d="M${x - rx - 0.3} ${y + 0.3}Q${x} ${y - ry - 1.5} ${x + rx + 0.3} ${y + 0.3}Z" fill="${shade(sk, -0.1)}"/><path d="M${x - rx} ${y + 0.3}L${x + rx} ${y + 0.3}" stroke="#1b1414" stroke-width=".9"/>`;
      s += `<ellipse cx="${x}" cy="${y}" rx="${rx + 0.4}" ry="${ry + 0.4}" fill="${shade(sk, -0.05)}" opacity="0"><animate attributeName="opacity" values="0;0;1;0" keyTimes="0;.93;.965;1" dur="${blink}s" repeatCount="indefinite"/></ellipse>`;
      return s;
    };
    if (L.eyes === "wink") return one(EL, "normal") + one(ER, "happy");
    return one(EL, L.eyes) + one(ER, L.eyes);
  }
  function browsSVG(L) {
    const c = shade(L.hair, -0.1);
    const w = L.brows === "thick" ? 2.3 : 1.3;
    const y = L.brows === "raised" ? 23 : 25.2;
    if (L.brows === "none") return "";
    if (L.brows === "angry" || L.eyes === "angry")
      return `<path d="M24.3 24.4L29.8 26.3M39.7 24.4L34.2 26.3" stroke="${c}" stroke-width="${Math.max(w, 1.7)}" stroke-linecap="round"/>`;
    return `<path d="M24.5 ${y}Q27.5 ${y - 1.6} 30 ${y - 0.2}M34 ${y - 0.2}Q36.5 ${y - 1.6} 39.5 ${y}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  }
  function noseSVG(L) {
    const c = shade(L.skin, -0.3);
    if (L.nose === "round") return `<ellipse cx="32" cy="33" rx="1.9" ry="1.5" fill="${shade(L.skin, -0.14)}"/>`;
    if (L.nose === "big") return `<path d="M31.5 29Q35.5 34.5 32.5 35.4Q30 35.6 29.6 34.4" stroke="${c}" stroke-width="1.1" fill="${shade(L.skin, -0.06)}" stroke-linecap="round"/>`;
    return `<path d="M32 30.5Q33.4 33.4 31.4 34" stroke="${c}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }
  function mouthSVG(L) {
    const c = L.lips;
    switch (L.mouth) {
      case "grin":
        return `<path d="M28 35.6Q32 40.4 36 35.6Z" fill="#fff" stroke="${c}" stroke-width="1.1" stroke-linejoin="round"/>`;
      case "laugh":
        return `<path d="M27.8 35.2Q32 42.5 36.2 35.2Z" fill="#5a1414" stroke="${c}" stroke-width="1"/><path d="M29.6 38.6Q32 37 34.4 38.6Q32 40.6 29.6 38.6Z" fill="#e2626a"/><path d="M28.6 35.6L35.4 35.6L35 36.6L29 36.6Z" fill="#fff"/>`;
      case "smirk":
        return `<path d="M28.6 37Q32 37.6 35.8 35" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
      case "neutral":
        return `<path d="M29 36.8L35 36.8" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/>`;
      case "tongue":
        return `<path d="M28.4 36Q32 38.8 35.6 36" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M30.4 37.2Q30.4 41.2 32.4 41.2Q34.2 41.2 34 37.2Z" fill="#e2626a"/>`;
      case "wow":
        return `<ellipse cx="32" cy="37" rx="1.8" ry="2.2" fill="#5a1414" stroke="${c}" stroke-width=".9"/>`;
      case "sad":
        return `<path d="M28.6 38Q32 35.2 35.4 38" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
      default:
        return `<path d="M28.4 36.2Q32 39 35.6 36.2" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    }
  }
  function facialSVG(L) {
    const f = "url(#h)";
    switch (L.facial) {
      case "beard":
        return `<path d="M21 30Q22 44 32 44Q42 44 43 30Q41 38.5 32 38.6Q23 38.5 21 30Z" fill="${f}"/><path d="M28 34.6Q32 33.2 36 34.6L35.4 35.6Q32 34.6 28.6 35.6Z" fill="${f}"/>`;
      case "goatee":
        return `<path d="M29.2 39Q32 44 34.8 39Q32 40.2 29.2 39Z" fill="${f}"/><path d="M28.2 34.8Q32 33.4 35.8 34.8L35 35.8Q32 34.8 29 35.8Z" fill="${f}"/>`;
      case "mustache":
        return `<path d="M27.6 35.4Q30 33 32 34.4Q34 33 36.4 35.4Q34 35 32 35.6Q30 35 27.6 35.4Z" fill="${f}"/>`;
      case "handlebar":
        return `<path d="M32 34.4Q29 32.6 27 34.6Q25.4 36 24.4 34.4Q25 37.4 27.6 36Q30 35 32 35.6Q34 35 36.4 36Q39 37.4 39.6 34.4Q38.6 36 37 34.6Q35 32.6 32 34.4Z" fill="${f}"/>`;
      case "stubble":
        return `<path d="M21.5 31Q22.5 43 32 43Q41.5 43 42.5 31Q40 38 32 38.4Q24 38 21.5 31Z" fill="${L.hair}" opacity=".28"/>`;
      default:
        return "";
    }
  }
  function glassesSVG(L) {
    const [lx, y] = EL;
    const rx = ER[0];
    switch (L.glasses) {
      case "reg":
        return `<rect x="${lx - 3.6}" y="${y - 2.8}" width="7.2" height="5.6" rx="1.6" fill="rgba(255,255,255,.15)" stroke="#222" stroke-width="1"/><rect x="${rx - 3.6}" y="${y - 2.8}" width="7.2" height="5.6" rx="1.6" fill="rgba(255,255,255,.15)" stroke="#222" stroke-width="1"/><path d="M30.9 ${y}L33.1 ${y}M20.6 ${y - 1}L23.7 ${y - 1}M40.3 ${y - 1}L43.4 ${y - 1}" stroke="#222" stroke-width="1"/>`;
      case "sun":
        return `<path d="M${lx - 4} ${y - 2.6}L${lx + 3.8} ${y - 2.6}Q${lx + 3.6} ${y + 3.4} ${lx} ${y + 3.2}Q${lx - 4} ${y + 3} ${lx - 4} ${y - 2.6}Z" fill="#111"/><path d="M${rx - 3.8} ${y - 2.6}L${rx + 4} ${y - 2.6}Q${rx + 4} ${y + 3} ${rx} ${y + 3.2}Q${rx - 3.6} ${y + 3.4} ${rx - 3.8} ${y - 2.6}Z" fill="#111"/><path d="M${lx + 3.8} ${y - 2}L${rx - 3.8} ${y - 2}M20.4 ${y - 2.2}L${lx - 4} ${y - 2.4}M43.6 ${y - 2.2}L${rx + 4} ${y - 2.4}" stroke="#111" stroke-width="1.1"/><path d="M${lx - 2.6} ${y - 1.4}L${lx - 0.8} ${y - 1.4}M${rx - 2.6} ${y - 1.4}L${rx - 0.8} ${y - 1.4}" stroke="rgba(255,255,255,.6)" stroke-width=".8"/>`;
      case "round":
        return `<circle cx="${lx}" cy="${y}" r="3.4" fill="rgba(255,255,255,.12)" stroke="#c9a43f" stroke-width="1"/><circle cx="${rx}" cy="${y}" r="3.4" fill="rgba(255,255,255,.12)" stroke="#c9a43f" stroke-width="1"/><path d="M${lx + 3.4} ${y}Q32 ${y - 1.4} ${rx - 3.4} ${y}" stroke="#c9a43f" stroke-width=".9" fill="none"/>`;
      case "star":
        return star(lx, y, 4.6, "#ff5fa2") + star(rx, y, 4.6, "#ff5fa2") + `<path d="M${lx + 3} ${y}L${rx - 3} ${y}" stroke="#ff5fa2" stroke-width="1"/>`;
      case "patch":
        return `<path d="M20 22.5L44 31" stroke="#111" stroke-width=".9"/><ellipse cx="${rx}" cy="${y}" rx="3.4" ry="3" fill="#111"/>`;
      case "mono":
        return `<circle cx="${rx}" cy="${y}" r="3.3" fill="rgba(255,255,255,.18)" stroke="#c9a43f" stroke-width="1.1"/><path d="M${rx + 2.4} ${y + 2.4}Q44 40 41 48" stroke="#c9a43f" stroke-width=".6" fill="none"/>`;
      case "vr":
        return `<rect x="${lx - 3.8}" y="${y - 2.6}" width="7.6" height="5.2" rx="1" fill="rgba(229,57,53,.75)"/><rect x="${rx - 3.8}" y="${y - 2.6}" width="7.6" height="5.2" rx="1" fill="rgba(30,136,229,.75)"/><path d="M20.4 ${y - 2.6}L43.6 ${y - 2.6}" stroke="#f4f1ea" stroke-width="1.4"/>`;
      default:
        return "";
    }
  }

  /* ===================== שיער ===================== */
  function hairBack(L) {
    switch (L.hs) {
      case 1:
        return `<path d="M18 27Q17 11 32 11Q47 11 46 27L48 52Q41 49 40 42L24 42Q23 49 16 52Z" fill="url(#h)"/>`;
      case 5:
        return `<path d="M42 18Q53 22 51 40Q50 48 46 52Q49 40 44 30Z" fill="url(#h)"/>`;
      case 7:
        return `<circle cx="32" cy="24" r="17" fill="url(#h)"/>`;
      case 9:
        return `<path d="M18 28Q17 11.5 32 11.5Q47 11.5 46 28L46.5 40Q41 41.5 39 38.5L25 38.5Q23 41.5 17.5 40Z" fill="url(#h)"/>`;
      case 10:
        return `<path d="M20 30Q16 42 19 54M44 30Q48 42 45 54" stroke="url(#h)" stroke-width="4.4" fill="none" stroke-linecap="round" stroke-dasharray="3.4 1"/><circle cx="19" cy="55" r="1.6" fill="${L.acc}"/><circle cx="45" cy="55" r="1.6" fill="${L.acc}"/>`;
      default:
        return "";
    }
  }
  function hairFront(L) {
    switch (L.hs) {
      case 0:
        return `<path d="M20.2 27Q19 13 32 13.2Q45 13 43.8 27Q42.5 19.5 35 19Q29 21.5 23 19.6Q21 22 20.2 27Z" fill="url(#h)"/>`;
      case 1:
      case 9:
        return `<path d="M20 27Q20 13.5 32 13.5Q44 13.5 44 27Q40 18.5 31 20Q24 21 20 27Z" fill="url(#h)"/>`;
      case 2:
        return `<circle cx="32" cy="11" r="5.6" fill="url(#h)"/><path d="M20.4 26Q20 14 32 14Q44 14 43.6 26Q40 18 32 18.6Q24 18 20.4 26Z" fill="url(#h)"/>`;
      case 3:
        return `<path d="M20.6 30Q20 25 21.5 23M43.4 30Q44 25 42.5 23" stroke="url(#h)" stroke-width="2.4" fill="none"/>`;
      case 4:
        return (
          [20, 24, 28, 32, 36, 40, 44].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 15 : 18}" r="${i === 0 || i === 6 ? 4.2 : 5.2}" fill="url(#h)"/>`).join("") +
          `<circle cx="22" cy="23" r="3.6" fill="url(#h)"/><circle cx="42" cy="23" r="3.6" fill="url(#h)"/>`
        );
      case 5:
        return `<path d="M20.4 27Q20 13.6 32 13.6Q44 13.6 43.6 27Q41 19 32 19.6Q24 20 20.4 27Z" fill="url(#h)"/>`;
      case 6:
        return `<path d="M21 26Q21 18 24 16M43 26Q43 18 40 16" stroke="${shade(L.hair, 0.35)}" stroke-width="1.2" opacity=".6" fill="none"/><path d="M28.6 22Q27.6 6 32 1.5Q36.4 6 35.4 22Z" fill="url(#h)"/>`;
      case 7:
        return `<path d="M20.6 25Q22 16 32 16Q42 16 43.4 25Q40 20 32 20Q24 20 20.6 25Z" fill="url(#h)"/>`;
      case 8:
        return `<path d="M20 26L18.5 14L24 18L24.5 8.5L29 15L32 6.5L35 15L39.5 8.5L40 18L45.5 14L44 26Q40 19.5 32 19.8Q24 19.5 20 26Z" fill="url(#h)"/>`;
      case 10:
        return `<path d="M20.4 27Q20 13.6 32 13.6Q44 13.6 43.6 27Q42 19 33 18.6L32 15L31 18.6Q22 19 20.4 27Z" fill="url(#h)"/>`;
      default:
        return "";
    }
  }

  /* ===================== כובעים ===================== */
  function hatSVG(L) {
    const c = L.hatc;
    const d = shade(c, -0.35);
    const l = shade(c, 0.25);
    switch (L.hat) {
      case "cap":
        return `<path d="M19.6 23Q19.6 10.5 32 10.5Q44.4 10.5 44.4 23Z" fill="${c}"/><path d="M32 10.5L32 23" stroke="${d}" stroke-width=".7"/><circle cx="32" cy="11" r="1.2" fill="${d}"/><path d="M18.6 22.4Q32 27.6 45.4 22.4L46 24.4Q32 30.4 18 24.4Z" fill="${d}"/>`;
      case "top":
        return `<rect x="22.5" y="-3" width="19" height="18" rx="1.5" fill="${c}"/><rect x="22.5" y="10" width="19" height="3.2" fill="${L.acc}"/><ellipse cx="32" cy="15.6" rx="15.5" ry="2.8" fill="${d}"/><path d="M24 -2L24 14" stroke="${l}" stroke-width="1.2" opacity=".5"/>`;
      case "cowboy":
        return `<path d="M22 18Q21 5 27 6Q32 9 37 6Q43 5 42 18Z" fill="${c}"/><path d="M22 15.6L42 15.6L42 18L22 18Z" fill="${d}"/><path d="M11 17Q16 22 32 21Q48 22 53 17Q50 23 32 24.6Q14 23 11 17Z" fill="${c}"/>`;
      case "crown":
        return `<path d="M21.5 18L20.5 6L26 12L32 3.5L38 12L43.5 6L42.5 18Z" fill="#f2c94c" stroke="#b8860b" stroke-width=".8"/><rect x="21.5" y="15.4" width="21" height="3.2" fill="#d4a017"/><circle cx="32" cy="12" r="1.6" fill="#e53935"/><circle cx="25.5" cy="14" r="1.1" fill="#1e88e5"/><circle cx="38.5" cy="14" r="1.1" fill="#43a047"/>`;
      case "beanie":
        return `<path d="M20 22Q19.5 8 32 8Q44.5 8 44 22Z" fill="${c}"/><rect x="19" y="18.5" width="26" height="5.6" rx="2.6" fill="${d}"/><path d="M23 19V24M27 19V24M31 19V24M35 19V24M39 19V24" stroke="${l}" stroke-width=".7" opacity=".6"/><circle cx="32" cy="6.5" r="3.4" fill="${l}"/>`;
      case "party":
        return `<path d="M24 18L35 -4L42 17Z" fill="${c}"/><path d="M27 12L39 9M29.5 6.5L37.6 3.6" stroke="${L.acc}" stroke-width="2"/><circle cx="35" cy="-4" r="2.8" fill="#ffcf3a"/><path d="M23 18.6Q33 21 43 17.4" stroke="#fff" stroke-width="1" fill="none"/>`;
      case "chef":
        return `<rect x="22" y="9" width="20" height="10" fill="#f6f3ee"/><circle cx="24" cy="7" r="5.2" fill="#fff"/><circle cx="32" cy="4.4" r="6.4" fill="#fff"/><circle cx="40" cy="7" r="5.2" fill="#fff"/><rect x="21.4" y="16" width="21.2" height="4" fill="#ece6dc"/>`;
      case "viking":
        return `<path d="M19.5 23Q19 9 32 9Q45 9 44.5 23Z" fill="#9aa1a8"/><path d="M19.5 21L44.5 21L44.5 23.6L19.5 23.6Z" fill="#6f777f"/><path d="M32 9L32 23" stroke="#6f777f" stroke-width="1.6"/><path d="M20.5 16Q13 15 11.5 5Q16 11 21.5 12.6Z" fill="#f4ecd8"/><path d="M43.5 16Q51 15 52.5 5Q48 11 42.5 12.6Z" fill="#f4ecd8"/>`;
      case "wizard":
        return `<path d="M21 17L33 -12L44 17Z" fill="${c}"/><ellipse cx="32.5" cy="17.4" rx="15" ry="2.8" fill="${d}"/>${star(30, 6, 2.2, "#ffcf3a")}${star(36.5, -2, 1.6, "#ffcf3a")}<circle cx="34" cy="11" r=".9" fill="#fff"/>`;
      case "pirate":
        return `<path d="M15 18Q20 4 32 6Q44 4 49 18Q42 14 32 16Q22 14 15 18Z" fill="#141414"/><path d="M15 18Q32 12 49 18" stroke="#c9a43f" stroke-width="1" fill="none"/><circle cx="32" cy="10.6" r="2.4" fill="#f4f1ea"/><path d="M29.5 13.8L34.5 15.6M34.5 13.8L29.5 15.6" stroke="#f4f1ea" stroke-width=".8"/><circle cx="31.2" cy="10.4" r=".5" fill="#141414"/><circle cx="32.8" cy="10.4" r=".5" fill="#141414"/>`;
      case "halo":
        return `<ellipse cx="32" cy="7" rx="10" ry="2.6" fill="none" stroke="#ffd84a" stroke-width="2"><animate attributeName="cy" values="7;5.6;7" dur="2.4s" repeatCount="indefinite"/></ellipse>`;
      case "horns":
        return `<path d="M23 18Q18 12 20 4Q22 12 27 15Z" fill="#c62828"/><path d="M41 18Q46 12 44 4Q42 12 37 15Z" fill="#c62828"/>`;
      case "band":
        return `<path d="M20.2 20.5Q32 17.5 43.8 20.5L43.6 24Q32 21 20.4 24Z" fill="${c}"/><path d="M20.3 22.2Q32 19.2 43.7 22.2" stroke="#fff" stroke-width=".8" fill="none"/><path d="M43.4 22L48 26L46 20.6Z" fill="${c}"/>`;
      case "bunny":
        return `<path d="M24 17Q19 -6 24.5 -8Q29.5 -6 28.5 15Z" fill="#f6f3ee"/><path d="M25 12Q22.6 -3 24.7 -5Q27 -3 27 12Z" fill="#f6b8c8"/><path d="M35.5 15Q34.5 -6 39.5 -8Q45 -6 40 17Z" fill="#f6f3ee"/><path d="M37 12Q37 -3 39.3 -5Q41.4 -3 39 12Z" fill="#f6b8c8"/><path d="M21 19Q32 14 43 19" stroke="${c}" stroke-width="2.4" fill="none"/>`;
      default:
        return "";
    }
  }

  /* כוס בירה עם קצף; x/y הפינה השמאלית העליונה */
  const beerMug = (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M10 4Q15 4 15 8.5Q15 13 10 13" stroke="rgba(255,255,255,.75)" stroke-width="1.8" fill="none"/>
<rect x="0" y="2" width="10.5" height="13" rx="1.6" fill="#f2a516"/><rect x="1.4" y="4" width="1.6" height="9" rx=".8" fill="#ffd36b" opacity=".8"/>
<rect x="0" y="2" width="10.5" height="13" rx="1.6" fill="none" stroke="rgba(255,255,255,.7)" stroke-width=".7"/>
<circle cx="2" cy="2" r="2.4" fill="#fff"/><circle cx="5.4" cy="1.2" r="2.8" fill="#fff"/><circle cx="8.8" cy="2" r="2.4" fill="#fff"/></g>`;

  /* ===================== חפצים ביד ===================== */
  function itemSVG(L, hx, hy) {
    switch (L.item) {
      case "beer":
        return beerMug(hx - 5, hy - 15, 1);
      case "drink":
        return `<path d="M${hx} ${hy}L${hx} ${hy - 9}" stroke="#ddd" stroke-width="1"/><path d="M${hx - 5.5} ${hy - 17}L${hx + 5.5} ${hy - 17}L${hx} ${hy - 9}Z" fill="rgba(255,255,255,.55)"/><path d="M${hx - 4} ${hy - 15.4}L${hx + 4} ${hy - 15.4}L${hx} ${hy - 10.6}Z" fill="#ff6f91"/><circle cx="${hx + 2.6}" cy="${hy - 17.4}" r="1.4" fill="#7cb342"/><path d="M${hx - 2} ${hy - 17}L${hx - 6} ${hy - 24}" stroke="#ffcf3a" stroke-width="1"/><path d="M${hx - 9} ${hy - 24}Q${hx - 6} ${hy - 28} ${hx - 3} ${hy - 24}Z" fill="#29b6f6"/>`;
      case "trophy":
        return `<path d="M${hx - 6} ${hy - 20}L${hx + 6} ${hy - 20}Q${hx + 6} ${hy - 9} ${hx} ${hy - 8}Q${hx - 6} ${hy - 9} ${hx - 6} ${hy - 20}Z" fill="#f2c94c" stroke="#b8860b" stroke-width=".6"/><path d="M${hx - 6} ${hy - 18}Q${hx - 10} ${hy - 17} ${hx - 6} ${hy - 12}M${hx + 6} ${hy - 18}Q${hx + 10} ${hy - 17} ${hx + 6} ${hy - 12}" stroke="#d4a017" stroke-width="1.2" fill="none"/><rect x="${hx - 1.2}" y="${hy - 8}" width="2.4" height="4" fill="#d4a017"/><rect x="${hx - 4}" y="${hy - 4.4}" width="8" height="2.6" rx=".6" fill="#5b3a1e"/>`;
      case "ball":
        return `<circle cx="${hx + 1}" cy="${hy + 4}" r="6" fill="#fff" stroke="#222" stroke-width=".6"/><path d="M${hx + 1} ${hy + 1.4}L${hx + 3.4} ${hy + 3.2}L${hx + 2.5} ${hy + 6}L${hx - 0.5} ${hy + 6}L${hx - 1.4} ${hy + 3.2}Z" fill="#222"/>`;
      case "flag":
        return `<path d="M${hx} ${hy + 4}L${hx} ${hy - 30}" stroke="#7a5a2a" stroke-width="1.4"/><path d="M${hx} ${hy - 30}L${hx + 16} ${hy - 26}L${hx} ${hy - 21}Z" fill="#e6b647"/><path d="M${hx} ${hy - 25.6}L${hx + 10} ${hy - 25}L${hx} ${hy - 21}Z" fill="#cf2033"/>`;
      case "mic":
        return `<rect x="${hx - 1.6}" y="${hy - 10}" width="3.2" height="11" rx="1.4" fill="#222"/><circle cx="${hx}" cy="${hy - 12}" r="3.4" fill="#9aa1a8"/><path d="M${hx - 2.6} ${hy - 12}L${hx + 2.6} ${hy - 12}M${hx} ${hy - 14.6}L${hx} ${hy - 9.4}" stroke="#6f777f" stroke-width=".5"/>`;
      case "rose":
        return `<path d="M${hx} ${hy + 2}Q${hx + 2} ${hy - 8} ${hx} ${hy - 16}" stroke="#2e7d32" stroke-width="1.2" fill="none"/><path d="M${hx + 1} ${hy - 6}Q${hx + 5} ${hy - 9} ${hx + 6} ${hy - 6}Q${hx + 3} ${hy - 4} ${hx + 1} ${hy - 6}Z" fill="#43a047"/><circle cx="${hx}" cy="${hy - 18}" r="3.6" fill="#c62828"/><path d="M${hx - 1.6} ${hy - 18.6}Q${hx} ${hy - 20.4} ${hx + 1.6} ${hy - 18.6}" stroke="#7f0000" stroke-width=".7" fill="none"/>`;
      case "chips":
        return [0, 1, 2, 3, 4].map((i) => `<ellipse cx="${hx}" cy="${hy - 3 - i * 2}" rx="4.4" ry="1.6" fill="${["#c62828", "#1f5fbf", "#1b1b1f", "#1f8a4c", "#e6b647"][i]}" stroke="#fff" stroke-width=".5" stroke-dasharray="1 1"/>`).join("");
      default:
        return "";
    }
  }

  /* ===================== הדמות המלאה =====================
     frame: 0 עמידה, 1/2 צעדי הליכה.
     layer: "all" רגיל · "base" בלי פנים (מתחת לתמונה) · "over" רק משקפיים וכובע (מעל התמונה). */
  C.avatarSVG = (look, o = {}) => {
    const L = C.cleanLook(look);
    const layer = o.layer || "all";
    /* מרווח מעל הראש לכובעים גבוהים — אותו יחס 1:2 כמו קודם */
    const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="128" viewBox="-3.5 -14 71 142">${inner}</svg>`;
    const hdefs = `<linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(L.hair, 0.22)}"/><stop offset="1" stop-color="${shade(L.hair, -0.25)}"/></linearGradient>`;
    if (layer === "over") return svg(`<defs>${hdefs}</defs>${glassesSVG(L)}${hatSVG(L)}`);

    const f = o.frame || 0;
    const sw = f === 1 ? 4 : f === 2 ? -4 : 0;
    const sk = L.skin;
    const staff = L.kind !== "guest";
    const out = staff ? "" : L.outfit;
    let top = L.top;
    let bot = L.bottom;
    if (L.kind === "dealer" || L.kind === "bartender") (top = "#f4f1ea"), (bot = "#15161a");
    if (L.kind === "waitress" || out === "tux") (top = L.kind === "waitress" ? "#141414" : "#16171b"), (bot = "#15161a");
    if (out === "chef" || out === "pirate") top = "#f4f1ea";
    const dress = out === "dress" || L.kind === "waitress";
    const robe = out === "wizard" || out === "king";
    const blink = (3 + ((L.top.charCodeAt(2) + L.hair.charCodeAt(3)) % 30) / 10).toFixed(1);
    const defs = `<defs>
<linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="${shade(top, 0.12)}"/><stop offset=".5" stop-color="${top}"/><stop offset="1" stop-color="${shade(top, -0.38)}"/></linearGradient>
<linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="${shade(bot, 0.1)}"/><stop offset="1" stop-color="${shade(bot, -0.35)}"/></linearGradient>
<radialGradient id="s" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="${shade(sk, 0.14)}"/><stop offset=".75" stop-color="${sk}"/><stop offset="1" stop-color="${shade(sk, -0.22)}"/></radialGradient>
${hdefs}</defs>`;
    let p = "";
    const photo = layer === "base";
    if (!photo) p += hairBack(L);
    /* גלימה / ברדס מאחור */
    if (out === "hero") p += `<path d="M18 50L46 50L53 114Q32 120 11 114Z" fill="${L.acc}"/>`;
    if (out === "king") p += `<path d="M17 49L47 49L54 118Q32 123 10 118Z" fill="#8b1a2b"/>`;
    if (out === "hoodie") p += `<path d="M16.5 52Q13 37 22 34.5L42 34.5Q51 37 47.5 52Z" fill="${shade(top, -0.25)}"/>`;
    /* רגליים */
    const shoe = (x) => `<ellipse cx="${x}" cy="120.5" rx="6.2" ry="3.2" fill="#100c0b"/>`;
    if (dress) {
      p += `<path d="M27 92L${27 + sw} 119" stroke="${shade(sk, -0.08)}" stroke-width="5" stroke-linecap="round"/>
<path d="M37 92L${37 - sw} 119" stroke="${shade(sk, -0.15)}" stroke-width="5" stroke-linecap="round"/>
<ellipse cx="${26 + sw}" cy="121" rx="4.6" ry="2.6" fill="#120d0d"/><ellipse cx="${38 - sw}" cy="121" rx="4.6" ry="2.6" fill="#120d0d"/>`;
    } else if (robe) {
      p += shoe(25 + sw * 0.5) + shoe(39 - sw * 0.5);
    } else if (out === "jersey") {
      p += `<path d="M27 92L${26 + sw} 116" stroke="${shade(sk, -0.06)}" stroke-width="6.5" stroke-linecap="round"/>
<path d="M37 92L${38 - sw} 116" stroke="${shade(sk, -0.14)}" stroke-width="6.5" stroke-linecap="round"/>
<path d="M${26.4 + sw * 0.85} 104L${26 + sw} 117M${37.6 - sw * 0.85} 104L${38 - sw} 117" stroke="${L.acc}" stroke-width="7" stroke-linecap="round"/>
<path d="M18 79L46 79L47 93L34 93L32 89L30 93L17 93Z" fill="url(#b)"/>${shoe(25 + sw)}${shoe(39 - sw)}`;
    } else {
      p += `<path d="M26.5 80L${26 + sw} 117" stroke="url(#b)" stroke-width="9" stroke-linecap="round"/>
<path d="M37.5 80L${38 - sw} 117" stroke="url(#b)" stroke-width="9" stroke-linecap="round"/>${shoe(25 + sw)}${shoe(39 - sw)}`;
    }
    /* זרועות */
    const tray = L.kind === "waitress";
    const hx = 50 + sw * 0.7;
    const hy = 81 - Math.abs(sw) * 0.3;
    const armL = `M19.5 52Q${12 - sw * 0.6} 66 ${14 - sw * 0.7} ${hy}`;
    const armR = tray ? "M44.5 52Q55 50 53 34" : `M44.5 52Q${52 + sw * 0.6} 66 ${hx} ${hy}`;
    const sleeve =
      L.kind === "dealer" || L.kind === "bartender" ? "#f4f1ea" : dress && out !== "wizard" ? sk : out === "jersey" ? sk : "url(#t)";
    const sw2 = robe ? 9.5 : 7.5;
    p += `<path d="${armL}" stroke="${sleeve}" stroke-width="${sw2}" stroke-linecap="round" fill="none"/>
<path d="${armR}" stroke="${sleeve}" stroke-width="${sw2}" stroke-linecap="round" fill="none"/>`;
    if (out === "jersey")
      p += `<path d="M19.5 52L17 60M44.5 52L47 60" stroke="url(#t)" stroke-width="8.5" stroke-linecap="round"/><path d="M16.4 59.4L18.6 60.2M47.6 59.4L45.4 60.2" stroke="${L.acc}" stroke-width="2"/>`;
    p += `<circle cx="${14 - sw * 0.7}" cy="${hy}" r="3.8" fill="${sk}"/><circle cx="${tray ? 53 : hx}" cy="${tray ? 33 : hy}" r="3.8" fill="${sk}"/>`;
    /* גוף */
    const torso = `<path d="M17 50Q32 43 47 50L46 81Q32 86 18 81Z" fill="url(#t)"/>`;
    const belt = `<rect x="18" y="77" width="28" height="4.5" rx="1.5" fill="${shade(bot, -0.3)}"/><rect x="30" y="77.3" width="4.5" height="3.8" rx="1" fill="#c9a43f"/>`;
    if (dress) {
      p += `<path d="M18 50Q32 44 46 50L45 74L51 101Q32 107 13 101L19 74Z" fill="url(#t)"/><path d="M19 74L45 74" stroke="${shade(top, -0.4)}" stroke-width="2"/>`;
      if (tray) p += `<path d="M23 66L41 66L43 94Q32 97 21 94Z" fill="#f6f3ee"/><path d="M26 50Q32 56 38 50" stroke="#f6f3ee" stroke-width="2.4" fill="none"/>`;
    } else if (robe) {
      p += `<path d="M17 50Q32 43 47 50L52 117Q32 122 12 117Z" fill="url(#t)"/>`;
      if (out === "wizard")
        p += star(25, 70, 2.4, "#ffcf3a") + star(39, 88, 2, "#ffcf3a") + star(28, 104, 1.8, "#ffcf3a") + `<path d="M19 78Q32 82 45 78" stroke="#c9a43f" stroke-width="1.6" fill="none"/>`;
      else
        p += `<path d="M27.5 47L29 118M36.5 47L35 118" stroke="#f6f3ee" stroke-width="4.2"/><path d="M27.5 60L29 60M36.5 75L35 75M28 92L29 92M35.6 104L34.6 104" stroke="#111" stroke-width="1.2"/><path d="M22 49Q32 62 42 49" stroke="#d4a017" stroke-width="1.4" fill="none"/><circle cx="32" cy="62" r="2.2" fill="#d4a017"/>`;
    } else {
      p += torso;
      if (out !== "jersey") p += belt;
    }
    if (L.kind === "dealer" || L.kind === "bartender") {
      p += `<path d="M17 51L27 47L32 70L37 47L47 51L46 81Q32 86 18 81Z" fill="#17181c"/>
<circle cx="32" cy="74" r=".9" fill="#c9a43f"/><circle cx="32" cy="66" r=".9" fill="#c9a43f"/>
<path d="M27 47L32 51L27 55ZM37 47L32 51L37 55Z" fill="${L.kind === "dealer" ? "#b3262e" : "#111"}"/><circle cx="32" cy="51" r="1.6" fill="${L.kind === "dealer" ? "#8f1c25" : "#000"}"/>`;
    } else if (!staff) {
      switch (out) {
        case "suit":
          p += `<path d="M27 46L32 63L37 46Z" fill="#f3f0ea"/><path d="M31 49L33 49L34.6 61L32 64L29.4 61Z" fill="${L.acc}"/><path d="M27 46L31 60M37 46L33 60" stroke="${shade(top, -0.45)}" stroke-width="1.3"/>`;
          break;
        case "tux":
          p += `<path d="M26.5 46L32 70L37.5 46Z" fill="#f3f0ea"/><path d="M27.4 47.6L32 51L27.4 54.4ZM36.6 47.6L32 51L36.6 54.4Z" fill="${L.acc}"/><circle cx="32" cy="51" r="1.4" fill="${shade(L.acc, -0.3)}"/><circle cx="32" cy="58" r=".8" fill="#222"/><circle cx="32" cy="63" r=".8" fill="#222"/><path d="M41 56L44 56" stroke="#f3f0ea" stroke-width="2"/>`;
          break;
        case "jersey":
          p += `<path d="M27 46L32 53L37 46" stroke="${L.acc}" stroke-width="2.2" fill="none"/><text x="32" y="74" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="12" text-anchor="middle" fill="#fff" stroke="${L.acc}" stroke-width=".8">${L.num}</text><circle cx="24" cy="56" r="1.8" fill="#e6b647" stroke="#cf2033" stroke-width=".6"/>`;
          break;
        case "hoodie":
          p += `<path d="M24 66L40 66L42 79L22 79Z" fill="${shade(top, -0.15)}"/><path d="M28.5 47L28 58M35.5 47L36 58" stroke="#f4f1ea" stroke-width="1"/><circle cx="28" cy="58.6" r=".9" fill="#f4f1ea"/><circle cx="36" cy="58.6" r=".9" fill="#f4f1ea"/>`;
          break;
        case "hero":
          p += `<circle cx="32" cy="60" r="7" fill="${L.acc}" stroke="#ffcf3a" stroke-width="1.2"/><path d="M33.5 54.5L29 61L32 61L30.5 66L35.5 59L32.5 59Z" fill="#ffcf3a"/><rect x="18" y="76" width="28" height="5" rx="1.5" fill="#ffcf3a"/>`;
          break;
        case "pirate":
          p += `<path d="M17 50Q22 46 27 47L28 81L18 81Z" fill="#4a2a12"/><path d="M47 50Q42 46 37 47L36 81L46 81Z" fill="#4a2a12"/><path d="M29 47L32 58L35 47" stroke="${shade(sk, -0.15)}" stroke-width="1.6" fill="${sk}"/><path d="M18 74L46 74L46 81L18 81Z" fill="#b3262e"/><path d="M40 78L45 90L42 90Z" fill="#b3262e"/>`;
          break;
        case "hawaii":
          p += [
            [24, 58, "#fff"],
            [38, 56, "#ffcf3a"],
            [30, 70, "#ff8fb1"],
            [41, 72, "#fff"],
            [22, 74, "#ffcf3a"],
          ]
            .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${c}"/><circle cx="${x}" cy="${y}" r=".9" fill="#e8742c"/>`)
            .join("") + `<path d="M27 46L32 54L37 46" stroke="${shade(top, -0.35)}" stroke-width="1.6" fill="${sk}"/>`;
          break;
        case "chef":
          p += `<circle cx="28" cy="58" r="1.1" fill="#bbb"/><circle cx="36" cy="58" r="1.1" fill="#bbb"/><circle cx="28" cy="66" r="1.1" fill="#bbb"/><circle cx="36" cy="66" r="1.1" fill="#bbb"/><path d="M26 47L32 52L38 47L36 50L32 54L28 50Z" fill="${L.acc}"/>`;
          break;
        case "shirt":
          p += `<path d="M27 46Q32 52 37 46" stroke="${shade(top, -0.3)}" stroke-width="1.6" fill="none"/>`;
          break;
      }
    }
    if (tray)
      p += `<ellipse cx="53" cy="31" rx="12" ry="2.6" fill="#c8c8c8"/><ellipse cx="53" cy="30.3" rx="12" ry="2.2" fill="#e9e9e9"/>${beerMug(43.5, 15.5, 0.95)}${beerMug(53.5, 15.5, 0.95)}`;
    if (!staff) p += itemSVG(L, hx, hy);
    /* צוואר וראש */
    p += `<rect x="28.3" y="38" width="7.4" height="10" rx="3" fill="${shade(sk, -0.12)}"/>
<ellipse cx="20.6" cy="30" rx="2.6" ry="3.6" fill="${shade(sk, -0.08)}"/><ellipse cx="43.4" cy="30" rx="2.6" ry="3.6" fill="${shade(sk, -0.08)}"/>`;
    if (L.earrings) p += `<circle cx="20.4" cy="34.4" r="1.4" fill="#f2c94c"/><circle cx="43.6" cy="34.4" r="1.4" fill="#f2c94c"/>`;
    p += `<ellipse cx="32" cy="28.5" rx="11.6" ry="13.2" fill="url(#s)"/>`;
    if (!photo) {
      if (L.freckles)
        p += [[25, 33], [26.6, 34.4], [24, 34.8], [39, 33], [37.4, 34.4], [40, 34.8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".45" fill="${shade(sk, -0.4)}"/>`).join("");
      p += `<circle cx="24.6" cy="33.5" r="2.4" fill="#e2626a" opacity="${L.blush ? 0.42 : 0.16}"/><circle cx="39.4" cy="33.5" r="2.4" fill="#e2626a" opacity="${L.blush ? 0.42 : 0.16}"/>`;
      p += facialSVG(L) + browsSVG(L) + eyesSVG(L, blink) + noseSVG(L) + mouthSVG(L) + hairFront(L);
      if (L.kind === "waitress") p += `<path d="M24 15.5Q32 11 40 15.5L39 18Q32 15 25 18Z" fill="#f6f3ee"/>`;
      if (!staff) p += glassesSVG(L) + hatSVG(L);
    }
    return svg(defs + p);
  };

  /* ===================== תמונות → כתובות =====================
     דמות עם תמונה מהאתר מורכבת על קנבס: גוף, התמונה בעיגול הפנים, ואז
     משקפיים וכובע מעליה. עד שהתמונה נטענת מוצגת הדמות הרגילה. */
  const svgURL = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const urlCache = new Map();
  const imgCache = new Map();
  const comp = new Map();
  const readyFns = new Set();
  C.onAvatarReady = (f) => readyFns.add(f);
  C.offAvatarReady = (f) => readyFns.delete(f);
  const loadImg = (src, cors) =>
    new Promise((res, rej) => {
      const im = new Image();
      if (cors) im.crossOrigin = "anonymous";
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  function composite(L, frame, k) {
    if (comp.has(k)) return comp.get(k);
    comp.set(k, null);
    Promise.all([
      loadImg(svgURL(C.avatarSVG(L, { frame, layer: "base" }))),
      loadImg(L.photo, true),
      loadImg(svgURL(C.avatarSVG(L, { layer: "over" }))),
    ])
      .then(([base, ph, over]) => {
        const S = 3;
        const F = (64 / 71) * S;
        const cv = document.createElement("canvas");
        cv.width = 64 * S;
        cv.height = 128 * S;
        const g = cv.getContext("2d");
        g.drawImage(base, 0, 0, cv.width, cv.height);
        /* ראש מוגדל (בובלהד) כדי שיזהו את הפנים */
        const rx = 15 * F, ry = 17 * F, cx = (32 + 3.5) * F, cy = (27 + 14) * F;
        g.save();
        g.beginPath();
        g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        g.clip();
        const sc = Math.max((rx * 2) / ph.width, (ry * 2) / ph.height);
        g.drawImage(ph, cx - (ph.width * sc) / 2, cy - (ph.height * sc) / 2, ph.width * sc, ph.height * sc);
        g.restore();
        g.strokeStyle = "rgba(0,0,0,.25)";
        g.lineWidth = F * 0.6;
        g.beginPath();
        g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        g.stroke();
        g.drawImage(over, 0, 0, cv.width, cv.height);
        const url = cv.toDataURL("image/png");
        comp.set(k, url);
        const im = imgCache.get(k);
        if (im) im.src = url;
        readyFns.forEach((f) => f());
      })
      .catch(() => {});
    return null;
  }
  C.avatarURL = (look, o = {}) => {
    const L = C.cleanLook(look);
    const frame = o.frame || 0;
    const k = JSON.stringify([L, frame]);
    if (L.photo && L.kind === "guest") {
      const u = composite(L, frame, k);
      if (u) return u;
    }
    let u = urlCache.get(k);
    if (!u) {
      u = svgURL(C.avatarSVG(L, { frame }));
      urlCache.set(k, u);
    }
    return u;
  };
  C.avatarImg = (look, frame = 0) => {
    const L = C.cleanLook(look);
    const k = JSON.stringify([L, frame]);
    let im = imgCache.get(k);
    if (!im) {
      im = new Image();
      imgCache.set(k, im);
      im.src = C.avatarURL(L, { frame });
    }
    return im;
  };

  /* תמונות השחקנים וההנהלה שהועלו לאתר (Cloudinary) — עם חיתוך אוטומטי לפנים.
     השמות נלקחים מרשימות SQUAD/STAFF שב-index.html, לפי המספר שבשם הקובץ. */
  async function siteNames() {
    try {
      const html = await (await fetch("index.html")).text();
      const grab = (name) => {
        const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\s*\\];`).exec(html);
        return m ? [...m[1].matchAll(/name:\s*"([^"]*)"/g)].map((x) => x[1]) : [];
      };
      return { player: grab("SQUAD"), staff: grab("STAFF") };
    } catch {
      return { player: [], staff: [] };
    }
  }
  let photosP = null;
  C.sitePhotos = () =>
    (photosP ||= (async () => {
      const out = [];
      const names = await siteNames();
      for (const tag of ["players", "staff"]) {
        try {
          const r = await fetch(`https://res.cloudinary.com/${CLOUD}/image/list/${tag}.json?_=${Date.now()}`);
          if (!r.ok) continue;
          const data = await r.json();
          const seen = new Set();
          (data.resources || [])
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .forEach((x) => {
              const m = /^(player|staff)-(\d+)-/.exec(String(x.public_id).split("/").pop());
              const id = m ? m[1] + m[2] : x.public_id;
              if (seen.has(id)) return;
              seen.add(id);
              const url = `${PHOTO_PREFIX}${FACE_CROP}/f_jpg,q_auto/v${x.version}/${x.public_id}.${x.format}`;
              if (okPhoto(url)) {
                const fromSite = m ? names[m[1]][+m[2]] : "";
                out.push({ name: String(fromSite || x.context?.custom?.person || "").slice(0, 30), url });
              }
            });
        } catch {}
      }
      return out;
    })());

  C.DEALER = C.cleanLook({ kind: "dealer", skin: "#ecbf98", hair: "#16100e", hs: 0, top: "#222428" });
  C.DEALER_F = C.cleanLook({ kind: "dealer", skin: "#d8a074", hair: "#3b2416", hs: 2, top: "#222428", lips: "#c2185b" });
  C.WAITRESS = (i = 0) =>
    C.cleanLook({
      kind: "waitress",
      skin: C.LOOK.skin[[0, 1, 2, 1][i % 4]],
      hair: ["#ecc96b", "#f3dc95", "#d9b24c", "#f6e3a8"][i % 4],
      hs: [5, 1, 9, 1][i % 4],
      lips: ["#e53935", "#c2185b", "#e53935", "#d1477a"][i % 4],
      eye: ["#1f6fb3", "#2e8b57", "#1f6fb3", "#6b6b6b"][i % 4],
      earrings: true,
      blush: true,
      top: "#141414",
    });
})();
