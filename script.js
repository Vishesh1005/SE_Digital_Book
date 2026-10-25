/* Software Testing digital book - vanilla JavaScript, no dependencies.
   A "view" is what the reader sees at once: one page, or (on very large screens) a two-page spread. */
(function () {
  "use strict";

  const pages = Array.from(document.querySelectorAll(".page"));
  const total = pages.length;
  const $ = (id) => document.getElementById(id);
  const book = $("book"), prevBtn = $("prevBtn"), nextBtn = $("nextBtn");
  const indicator = $("indicator"), bar = $("bar"), progress = $("progress");
  const tocBtn = $("tocBtn"), toc = $("toc"), tocList = $("tocList"), scrim = $("scrim");
  const themeBtn = $("themeBtn"), fsBtn = $("fsBtn"), printBtn = $("printBtn"), toast = $("toast");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  /* Same thresholds as the CSS: a spread is used only when each page can stay readable. */
  const spreadQuery = window.matchMedia("(min-width: 1600px) and (min-height: 800px)");

  let spread = spreadQuery.matches;
  let views = buildViews();
  let vCur = 0;
  let busy = false;
  let endNow = null;
  let toastTimer = null;

  function buildViews() {
    if (!spread) return pages.map((_, i) => [i]);
    const v = [[0]];                                   // the cover always stands alone
    for (let i = 1; i < total; i += 2) v.push(i + 1 < total ? [i, i + 1] : [i]);
    return v;
  }
  const viewOf = (pageIndex) => Math.max(0, views.findIndex((v) => v.includes(pageIndex)));

  /* ---------- safe storage (works on file:// and in private mode) ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ }
    }
  };

  /* ---------- toast feedback ---------- */
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  /* ---------- table of contents ---------- */
  pages.forEach((p, i) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#page-" + (i + 1);
    a.dataset.index = i;
    a.innerHTML = "<b>" + (i + 1) + "</b><span></span>";
    a.lastChild.textContent = p.dataset.title;
    a.addEventListener("click", (e) => { e.preventDefault(); goView(viewOf(i)); setToc(false); });
    li.appendChild(a);
    tocList.appendChild(li);
  });
  toc.hidden = false; // visibility is controlled by the .open class

  function setToc(open) {
    toc.classList.toggle("open", open);
    scrim.hidden = !open;
    tocBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      (tocList.querySelector('[aria-current="page"]') || tocList.querySelector("a")).focus();
    } else if (toc.contains(document.activeElement)) {
      tocBtn.focus();
    }
  }
  tocBtn.addEventListener("click", () => setToc(!toc.classList.contains("open")));
  scrim.addEventListener("click", () => setToc(false));

  /* ---------- scrollable page content: accessibility + "scroll for more" hint ---------- */
  const scrollers = pages.map((p) => p.querySelector(".page-inner"));
  function updateMore(i) {
    const p = pages[i], s = scrollers[i];
    const more = !p.hidden && s.scrollHeight - s.scrollTop - s.clientHeight > 12;
    p.classList.toggle("has-more", more);
  }
  const refreshMore = () => pages.forEach((_, i) => updateMore(i));
  scrollers.forEach((s, i) => {
    s.tabIndex = 0;
    s.setAttribute("role", "region");
    s.setAttribute("aria-label", pages[i].dataset.title);
    s.addEventListener("scroll", () => updateMore(i), { passive: true });
  });
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver((entries) => entries.forEach((en) => updateMore(scrollers.indexOf(en.target))));
    scrollers.forEach((s) => ro.observe(s));
  }
  window.addEventListener("resize", refreshMore);

  /* ---------- placing pages in the book grid ---------- */
  function setCols(n) { book.style.setProperty("--cols", String(n)); }
  function seat(view) {          // un-hide the pages of a view and put each in its column
    view.forEach((idx, pos) => {
      const p = pages[idx];
      p.hidden = false;
      p.style.gridColumn = String(pos + 1);
      p.dataset.pos = String(pos);
      if (pos === view.length - 1) p.setAttribute("data-edge", ""); else p.removeAttribute("data-edge");
    });
  }
  function unseat(p) { p.hidden = true; p.style.gridColumn = ""; p.removeAttribute("data-pos"); }
  function resetScroll(idx) { scrollers[idx].scrollTop = 0; }

  function updateUI() {
    const v = views[vCur], first = v[0], last = v[v.length - 1];
    indicator.textContent = v.length > 1
      ? "Pages " + (first + 1) + "\u2013" + (last + 1) + " of " + total
      : "Page " + (first + 1) + " of " + total;
    const pct = Math.round(((last + 1) / total) * 100);
    bar.style.width = pct + "%";
    progress.setAttribute("aria-valuenow", String(pct));
    progress.setAttribute("aria-valuetext", indicator.textContent + ", " + pct + " percent");
    prevBtn.setAttribute("aria-disabled", String(vCur === 0));
    nextBtn.setAttribute("aria-disabled", String(vCur === views.length - 1));
    prevBtn.style.opacity = vCur === 0 ? ".5" : "";
    nextBtn.style.opacity = vCur === views.length - 1 ? ".5" : "";
    tocList.querySelectorAll("a").forEach((a) => {
      if (v.includes(Number(a.dataset.index))) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    pages.forEach((p, i) => {
      const shown = v.includes(i);
      p.inert = !shown;
      if (shown) p.removeAttribute("aria-hidden"); else p.setAttribute("aria-hidden", "true");
    });
    book.dataset.spread = String(spread);
    if (history.replaceState) history.replaceState(null, "", "#page-" + (first + 1));
    store.set("stbook-page", String(first));
  }

  function render(vi) {          // show a view instantly (start-up, resize, reduced motion)
    vCur = vi;
    pages.forEach(unseat);
    seat(views[vi]);
    setCols(views[vi].length);
    updateUI();
    refreshMore();
  }

  /* ---------- page turning ---------- */
  function goView(vi) {
    if (vi < 0) { edge("You are on the first page."); return; }
    if (vi > views.length - 1) { edge("You have reached the last page."); return; }
    if (vi === vCur || busy) return;

    const oldView = views[vCur], newView = views[vi];
    const forward = vi > vCur;
    const oldEls = oldView.map((i) => pages[i]);
    const newEls = newView.map((i) => pages[i]);
    vCur = vi;

    if (reduceMotion.matches) {
      render(vi);
      newView.forEach(resetScroll);
    } else {
      busy = true;
      seat(newView);
      setCols(Math.max(oldView.length, newView.length)); // keep both views inside the book while turning
      updateUI();
      /* Forward: the right-hand old page turns away. Backward: the right-hand new page turns back in.
         Any left-hand page of a spread simply fades. */
      const flipEl = forward ? oldEls[oldEls.length - 1] : newEls[newEls.length - 1];
      const fadeEls = forward ? oldEls.slice(0, -1) : newEls.slice(0, -1);
      (forward ? newEls : oldEls).forEach((p) => p.classList.add("under"));
      fadeEls.forEach((p) => p.classList.add(forward ? "fade-out" : "fade-in"));
      flipEl.classList.add(forward ? "flip-out" : "flip-in");

      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        oldEls.forEach(unseat);
        [...oldEls, ...newEls].forEach((p) => p.classList.remove("flip-out", "flip-in", "fade-out", "fade-in", "under"));
        seat(newView);
        setCols(newView.length);
        newView.forEach(resetScroll);
        busy = false;
        endNow = null;
        refreshMore();
      };
      endNow = end;
      flipEl.addEventListener("animationend", (e) => { if (e.target === flipEl) end(); });
      const timer = setTimeout(end, 1100);   // safety net if animationend never fires
    }
    const h = newEls[0].querySelector("h1,h2");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  function edge(msg) {
    say(msg);
    if (!reduceMotion.matches) {
      book.classList.remove("shake");
      void book.offsetWidth;
      book.classList.add("shake");
    }
  }

  prevBtn.addEventListener("click", () => goView(vCur - 1));
  nextBtn.addEventListener("click", () => goView(vCur + 1));

  /* ---------- layout switching (resize, rotation, entering/leaving fullscreen) ---------- */
  function onModeChange() {
    if (endNow) endNow();                       // finish any page turn first
    const first = views[vCur][0];               // keep the reader on the same page
    spread = spreadQuery.matches;
    views = buildViews();
    render(viewOf(first));
  }
  if (spreadQuery.addEventListener) spreadQuery.addEventListener("change", onModeChange);
  else spreadQuery.addListener(onModeChange);

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Escape" && toc.classList.contains("open")) { setToc(false); return; }
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (toc.classList.contains("open")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); goView(vCur + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goView(vCur - 1); }
    else if (e.key === "Home" && !(t && t.classList && t.classList.contains("page-inner"))) { e.preventDefault(); goView(0); }
    else if (e.key === "End" && !(t && t.classList && t.classList.contains("page-inner"))) { e.preventDefault(); goView(views.length - 1); }
  });

  /* ---------- touch swipe ---------- */
  let sx = null, sy = null;
  book.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  book.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = sy = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) goView(vCur + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------- theme ---------- */
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeBtn.setAttribute("aria-pressed", String(theme === "dark"));
    store.set("stbook-theme", theme);
  }
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setTheme(next);
    say(next === "dark" ? "Dark reading mode" : "Light reading mode");
  });
  setTheme(store.get("stbook-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  /* ---------- fullscreen ---------- */
  const root = document.documentElement;
  if (!(root.requestFullscreen || root.webkitRequestFullscreen)) {
    fsBtn.hidden = true;
  } else {
    fsBtn.addEventListener("click", () => {
      const inFs = document.fullscreenElement || document.webkitFullscreenElement;
      const p = inFs
        ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
        : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
      if (p && p.catch) p.catch(() => say("Fullscreen is not available here."));
    });
  }

  /* ---------- print / save as PDF ---------- */
  printBtn.addEventListener("click", () => window.print());
  window.addEventListener("beforeprint", () => pages.forEach((p) => { p.inert = false; }));
  window.addEventListener("afterprint", updateUI);

  /* ---------- editable cover details (saved in this browser only) ---------- */
  document.querySelectorAll(".editable").forEach((el) => {
    const saved = store.get("stbook-" + el.dataset.key);
    if (saved) el.textContent = saved;
    el.addEventListener("input", () => store.set("stbook-" + el.dataset.key, el.textContent.trim()));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); el.blur(); } });
    el.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\s+/g, " ");
      document.execCommand("insertText", false, text);
    });
  });

  /* ---------- start page from URL hash ---------- */
  function hashIndex() {
    const m = /^#page-(\d+)$/.exec(location.hash);
    return m && +m[1] >= 1 && +m[1] <= total ? +m[1] - 1 : 0;
  }
  render(viewOf(hashIndex()));
  window.addEventListener("hashchange", () => {
    const v = viewOf(hashIndex());
    if (v !== vCur) goView(v);
  });
})();
