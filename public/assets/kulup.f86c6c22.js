// Shared client script for every page (built into /assets/kulup.<hash>.js by lib.mjs writeShared).
// Loaded once per full page load; Astro page swaps keep it alive, so page modules go through onPage().
(() => {
  if (window.__kulupInit) return;
  window.__kulupInit = true;

  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- per-page modules: run on first load and after each Astro swap; cleanups run before the next page ----
  const modules = [];
  let cleanups = [];
  let lastMain = null;
  const onPage = (fn) => modules.push(fn);
  function runPage() {
    const main = document.querySelector("main");
    if (!main || main === lastMain) return;
    lastMain = main;
    cleanups.forEach((c) => c());
    cleanups = modules.map((fn) => fn()).filter((c) => typeof c === "function");
  }

  // Atatürk: the last 8 of 1938 turns into ∞ when it scrolls into view
  onPage(() => {
    const s = document.querySelector(".ak-sonsuz");
    if (!s || !("IntersectionObserver" in window) || reduceMotion()) return;
    s.classList.add("ak-bekle");
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) { s.classList.add("ak-don"); io.disconnect(); }
    }, { threshold: 1, rootMargin: "0px 0px -15% 0px" });
    io.observe(s);
    return () => io.disconnect();
  });

  // Atatürk: Andımız words light up with scroll; --p drives the flag drawing in CSS
  onPage(() => {
    const sec = document.querySelector(".ak-and");
    if (!sec || reduceMotion()) return;
    const words = [...sec.querySelectorAll(".w")];
    sec.classList.add("ak-and--js");
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = sec.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      const lit = Math.round(Math.min(1, p / 0.8) * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < lit));
      sec.style.setProperty("--p", p.toFixed(4));
      sec.classList.toggle("ak-and--tamam", p > 0.95);
    };
    const schedule = () => { raf ||= requestAnimationFrame(update); };
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    update();
    return () => { removeEventListener("scroll", schedule); removeEventListener("resize", schedule); cancelAnimationFrame(raf); };
  });

  document.addEventListener("astro:page-load", runPage);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runPage);
  else runPage();

  // ---- macOS-style context menu (mouse/trackpad only; touch devices keep their native long-press menu) ----
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const PANEL = "/ogrenci-paneli";
  const PAGES = [["Ana Sayfa","/","home"],["Öğrenci Paneli","/ogrenci-paneli/","panel"],["Hakkımızda","/who-we-are/","info"],["Ekibimiz","/who-we-are/#Team","team"],["Haberler","/news/","news"],["Atatürk Köşesi","/ataturk-kosesi/","flag"],["İletişim","/contact/","mail"]];
  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    panel: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14c2.8.2 5 2.6 5 5.5"/>',
    news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    back: '<path d="M15 18 9 12l6-6"/>',
    fwd: '<path d="m9 18 6-6-6-6"/>',
    reload: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
    link: '<path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1 1M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1-1"/>',
    top: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ""}</svg>`;
  const norm = (p) => p.replace(/index\.html$/, "").replace(/\/?$/, "/");

  let menu = null;
  let lastFocus = null;

  function isCurrent(href) {
    const u = new URL(href, location.href);
    return norm(u.pathname) === norm(location.pathname) && u.hash === location.hash;
  }

  function toast(text) {
    const t = document.createElement("div");
    t.className = "km-toast";
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("km-toast--out"), 1400);
    setTimeout(() => t.remove(), 1800);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = location.href;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast("Bağlantı kopyalandı");
  }

  const ACTIONS = {
    back: () => history.back(),
    fwd: () => history.forward(),
    reload: () => location.reload(),
    link: copyLink,
    top: () => {
      const btn = document.getElementById("scroll-top");
      if (btn && btn.offsetParent !== null) btn.click();
      else window.scrollTo({ top: 0, behavior: "smooth" });
    },
  };

  function render() {
    const pages = PAGES.map(([label, href, icon]) => {
      const cur = isCurrent(href);
      const reload = href.startsWith(PANEL) ? " data-astro-reload" : "";
      return `<a class="km-item${cur ? " km-item--current" : ""}" role="menuitem" href="${href}"${reload}${cur ? ' aria-current="page"' : ""} tabindex="-1">${svg(icon)}<span class="km-label">${label}</span>${cur ? `<span class="km-check">${svg("check")}</span>` : ""}</a>`;
    }).join("");
    const act = (key, label, icon, shortcut, disabled) =>
      `<button type="button" class="km-item" role="menuitem" data-km="${key}" tabindex="-1"${disabled ? " disabled" : ""}>${svg(icon)}<span class="km-label">${label}</span>${shortcut ? `<kbd class="km-kbd">${shortcut}</kbd>` : ""}</button>`;
    return `<div class="km-title">Teknoloji Kulübü</div>${pages}<div class="km-sep" role="separator"></div>${act("back", "Geri", "back", "Alt ←", history.length <= 1)}${act("fwd", "İleri", "fwd", "Alt →")}${act("reload", "Yenile", "reload", "F5")}<div class="km-sep" role="separator"></div>${act("link", "Sayfa bağlantısını kopyala", "link")}${act("top", "En üste çık", "top", "", window.scrollY < 10)}`;
  }

  function items() {
    return menu ? [...menu.querySelectorAll(".km-item:not([disabled])")] : [];
  }

  function close(restore) {
    if (!menu) return;
    const m = menu;
    menu = null;
    m.classList.add("km--out");
    setTimeout(() => m.remove(), 120);
    if (restore && lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function open(x, y) {
    close(false);
    lastFocus = document.activeElement;
    menu = document.createElement("div");
    menu.className = "km";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Site menüsü");
    menu.innerHTML = render();
    document.body.appendChild(menu);

    const r = menu.getBoundingClientRect();
    const pad = 8;
    const left = x + r.width + pad > innerWidth ? Math.max(pad, x - r.width) : x;
    const top = y + r.height + pad > innerHeight ? Math.max(pad, y - r.height) : y;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.transformOrigin = `${left < x ? "right" : "left"} ${top < y ? "bottom" : "top"}`;
    void menu.offsetWidth; // commit the start state so the open transition runs (rAF can stall in background tabs)
    menu.classList.add("km--in");
  }

  document.addEventListener("contextmenu", (e) => {
    // keep the native menu on touch devices, in text fields (copy/paste) and as an escape hatch with Shift
    if (!finePointer.matches || e.shiftKey || e.target.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    e.preventDefault();
    let { clientX: x, clientY: y } = e;
    if (x === 0 && y === 0 && document.activeElement && document.activeElement !== document.body) {
      const b = document.activeElement.getBoundingClientRect();
      x = b.left + 12;
      y = b.bottom;
    }
    open(x, y);
    if (x !== e.clientX || e.button !== 2) items()[0]?.focus();
  });

  document.addEventListener("click", (e) => {
    if (!menu) return;
    const hit = e.target.closest?.(".km-item");
    if (!menu.contains(e.target)) return close(false);
    if (!hit || hit.disabled) return;
    const action = hit.dataset.km;
    close(false);
    if (action) ACTIONS[action]();
  });

  document.addEventListener("keydown", (e) => {
    if (!menu) return;
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === "Tab") close(false);
  });

  for (const ev of ["resize", "blur"]) window.addEventListener(ev, () => close(false));
  window.addEventListener("wheel", () => close(false), { passive: true });
  document.addEventListener("astro:before-preparation", () => close(false));
})();
