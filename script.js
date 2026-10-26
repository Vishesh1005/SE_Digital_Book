/* Software Development Methodologies digital book - vanilla JavaScript, no dependencies.
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
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
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
    store.set("sdmbook-page", String(first));
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
    store.set("sdmbook-theme", theme);
  }
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setTheme(next);
    say(next === "dark" ? "Dark reading mode" : "Light reading mode");
  });
  setTheme(store.get("sdmbook-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

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
    const saved = store.get("sdmbook-" + el.dataset.key) || store.get("stbook-" + el.dataset.key);
    if (saved) el.textContent = saved;
    el.addEventListener("input", () => store.set("sdmbook-" + el.dataset.key, el.textContent.trim()));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); el.blur(); } });
    el.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\s+/g, " ");
      document.execCommand("insertText", false, text);
    });
  });

  /* ---------- interactive methodology diagrams ---------- */
  const stageData = {
    waterfall: {
      req: {
        title: "1. Requirements Analysis & Specification",
        badge: "Phase 1 of 6",
        desc: "System services, constraints, and goals are gathered through stakeholder consultation and documented in a formal Software Requirements Specification (SRS) before design begins (Sommerville, 2016; Pressman & Maxim, 2020)."
      },
      des: {
        title: "2. System & Software Design",
        badge: "Phase 2 of 6",
        desc: "Allocates requirements to hardware or software subsystems and defines overall system architecture, database schemas, module interfaces, and algorithms (Sommerville, 2016)."
      },
      imp: {
        title: "3. Implementation & Unit Coding",
        badge: "Phase 3 of 6",
        desc: "Translates software design specifications into executable source code modules and verifies individual program units (Pressman & Maxim, 2020)."
      },
      tst: {
        title: "4. Integration & System Testing",
        badge: "Phase 4 of 6",
        desc: "Integrates program units into a complete system and validates behaviour against the SRS to uncover defects prior to customer delivery (Royce, 1970; Sommerville, 2016)."
      },
      dep: {
        title: "5. Deployment (Installation & Release)",
        badge: "Phase 5 of 6",
        desc: "Delivers the verified software into the target production environment, including data migration, user training, and cutover (Pressman & Maxim, 2020)."
      },
      mnt: {
        title: "6. Maintenance & Evolution",
        badge: "Phase 6 of 6",
        desc: "Corrects residual faults discovered in live operation, adapts the software to new operating environments, and adds minor customer enhancements (Sommerville, 2016)."
      }
    },
    scrum: {
      backlog: {
        title: "Product Backlog",
        badge: "Scrum Artifact",
        desc: "An emergent, ordered list of features, enhancements, and fixes needed to improve the product. It is the single source of work undertaken by the Scrum Team and is managed by the Product Owner (Schwaber & Sutherland, 2020)."
      },
      planning: {
        title: "Sprint Planning",
        badge: "Event (Max 8h for 1-month Sprint)",
        desc: "Initiates the Sprint by defining why the Sprint is valuable (the Sprint Goal), selecting Product Backlog items for the Sprint, and planning how Developers will create a Done Increment (Schwaber & Sutherland, 2020)."
      },
      sprint: {
        title: "Sprint & Daily Scrum",
        badge: "Container Event (1–4 Weeks) + 15-min Daily",
        desc: "Fixed-length iteration turning selected items into a usable Increment. Every 24 hours, Developers hold a 15-minute Daily Scrum to inspect progress toward the Sprint Goal and adapt the Sprint Backlog (Schwaber & Sutherland, 2020)."
      },
      review: {
        title: "Sprint Review",
        badge: "Event (Max 4h for 1-month Sprint)",
        desc: "The Scrum Team and stakeholders inspect what was accomplished during the Sprint and collaborate on what to do next, adapting the Product Backlog to meet new opportunities (Schwaber & Sutherland, 2020)."
      },
      retro: {
        title: "Sprint Retrospective",
        badge: "Event (Max 3h for 1-month Sprint)",
        desc: "The Scrum Team inspects how the last Sprint went regarding individuals, interactions, processes, tools, and their Definition of Done, planning concrete quality and effectiveness improvements (Schwaber & Sutherland, 2020)."
      },
      next: {
        title: "Next Sprint",
        badge: "Continuous Empirical Loop",
        desc: "A new Sprint starts immediately after the conclusion of the previous Sprint, carrying forward refined backlog priorities and retrospective process improvements (Schwaber & Sutherland, 2020)."
      }
    },
    devops: {
      plan: {
        title: "1. Plan",
        badge: "Dev (Continuous Planning)",
        desc: "Teams define backlog items, user stories, architectural tasks, and security requirements using agile boards and issue trackers, aligning engineering work with operational telemetry (Microsoft, 2023)."
      },
      code: {
        title: "2. Code",
        badge: "Dev (Version Control)",
        desc: "Developers write application and infrastructure-as-code in short-lived feature branches using Git version control and peer pull-request reviews (GitHub, n.d.; Microsoft, 2023)."
      },
      build: {
        title: "3. Build",
        badge: "CI (Automated Build)",
        desc: "Continuous Integration (CI) pipelines automatically compile source code, resolve dependencies, and package immutable build artifacts or container images on every commit (GitHub, n.d.)."
      },
      test: {
        title: "4. Test",
        badge: "CI (Automated Verification)",
        desc: "Automated unit, integration, security, and static-analysis suites run inside the CI workflow to catch regressions immediately when they are cheapest to fix (Microsoft, 2023)."
      },
      release: {
        title: "5. Release",
        badge: "CD (Release Readiness)",
        desc: "Verified builds are versioned, signed, and staged in artifact registries with automated quality gates or manual approval policies ready for production handover (Microsoft, 2023)."
      },
      deploy: {
        title: "6. Deploy",
        badge: "CD (Production Delivery)",
        desc: "Automated pipelines deploy changes to production using strategies such as blue-green or canary releases and Infrastructure as Code (IaC) without downtime (GitHub, n.d.; Microsoft, 2023)."
      },
      operate: {
        title: "7. Operate",
        badge: "Ops (Runtime Management)",
        desc: "Platform and operations teams manage live cloud infrastructure, auto-scaling, configuration states, and incident response to maintain high availability (Microsoft, 2023)."
      },
      monitor: {
        title: "8. Monitor → Plan",
        badge: "Ops (Continuous Feedback)",
        desc: "Full-stack observability collects logs, metrics, traces, and user experience telemetry, feeding actionable insights directly back into the next Plan cycle (Microsoft, 2023)."
      }
    }
  };

  function setupDiagram(diagramKey) {
    const info = stageData[diagramKey];
    if (!info) return;
    const titleEl = $(diagramKey + "-title");
    const badgeEl = $(diagramKey + "-badge");
    const descEl = $(diagramKey + "-desc");
    const nodes = Array.from(document.querySelectorAll('[data-diagram="' + diagramKey + '"]'));
    if (!titleEl || !descEl || !nodes.length) return;

    function selectStage(stageId) {
      const d = info[stageId];
      if (!d) return;
      titleEl.textContent = d.title;
      if (badgeEl) badgeEl.textContent = d.badge;
      descEl.textContent = d.desc;
      nodes.forEach((el) => {
        const match = el.dataset.stage === stageId;
        el.classList.toggle("active", match);
        el.setAttribute("aria-pressed", String(match));
      });
      refreshMore();
    }

    nodes.forEach((el) => {
      el.addEventListener("click", () => selectStage(el.dataset.stage));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectStage(el.dataset.stage);
        }
      });
    });
  }

  setupDiagram("waterfall");
  setupDiagram("scrum");
  setupDiagram("devops");

  /* ---------- interactive methodology comparison filter ---------- */
  const compTable = $("compTable");
  const compNote = $("compNote");
  const compNotes = {
    all: "Click a methodology button above or any column header to highlight its characteristics.",
    1: "Waterfall suits safety-critical, defense, or regulatory projects where requirements are fixed upfront.",
    2: "RAD suits modular business systems with committed users and a strict 60–90 day delivery window.",
    3: "Agile / Scrum suits product development with evolving requirements and regular stakeholder feedback.",
    4: "DevOps suits cloud and web services requiring continuous integration, automated delivery, and live monitoring."
  };
  if (compTable) {
    const filterBtns = Array.from(document.querySelectorAll("[data-comp-col]"));
    function highlightCol(colIdx) {
      filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.compCol === String(colIdx))));
      compTable.querySelectorAll("tr").forEach((tr) => {
        Array.from(tr.children).forEach((cell, idx) => {
          cell.classList.toggle("hl-col", colIdx !== "all" && idx === Number(colIdx));
        });
      });
      if (compNote && compNotes[colIdx]) compNote.textContent = compNotes[colIdx];
    }
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => highlightCol(btn.dataset.compCol));
    });
    compTable.querySelectorAll("thead th[data-col]").forEach((th) => {
      th.style.cursor = "pointer";
      th.addEventListener("click", () => highlightCol(th.dataset.col));
    });
  }

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
