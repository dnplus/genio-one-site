(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const header = document.querySelector(".site-header");
  const heroVisual = document.querySelector(".hero-visual");
  const statement = document.querySelector(".statement-title");
  let queued = false;

  const update = () => {
    queued = false;
    const scrollY = window.scrollY;
    const viewport = window.innerHeight;
    const statementTop = statement ? statement.getBoundingClientRect().top : 0;
    header?.classList.toggle("is-scrolled", scrollY > 8);
    if (reduceMotion.matches) return;
    if (heroVisual) {
      const progress = Math.min(scrollY / viewport, 1);
      heroVisual.style.setProperty("--hero-shift", (progress * 90).toFixed(1));
      heroVisual.style.setProperty("--hero-fade", progress.toFixed(3));
    }
    if (statement) {
      const progress = (viewport * 0.9 - statementTop) / (viewport * 0.5);
      statement.style.setProperty("--p", Math.min(Math.max(progress, 0), 1).toFixed(3));
    }
  };

  const requestUpdate = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  update();
})();

(() => {
  const items = document.querySelectorAll("[data-reveal]");
  const scenes = document.querySelectorAll("[data-ambient]");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-in"));
    scenes.forEach((scene) => scene.classList.add("is-active"));
    document.documentElement.classList.add("js");
    return;
  }

  const revealer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      revealer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
  const fold = window.innerHeight;
  items.forEach((item) => {
    if (item.getBoundingClientRect().top < fold) item.classList.add("is-in");
    else revealer.observe(item);
  });

  const director = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle("is-active", entry.isIntersecting);
  }, { rootMargin: "120px 0px" });
  scenes.forEach((scene) => director.observe(scene));
  document.documentElement.classList.add("js");
})();

(() => {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  document.querySelectorAll("[data-spotlight]").forEach((group) => {
    const cards = group.querySelectorAll(".spotlight");
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const paint = () => {
      frame = 0;
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${Math.round(pointerX - rect.left)}px`);
        card.style.setProperty("--my", `${Math.round(pointerY - rect.top)}px`);
      }
    };
    group.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    });
  });
})();

(() => {
  const copyButton = document.querySelector(".install-copy");
  const codeEl = document.querySelector("#install-command code");
  if (copyButton && codeEl) {
    let resetTimer;
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeEl.textContent);
      } catch {
        const range = document.createRange();
        range.selectNode(codeEl);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("copy");
        selection.removeAllRanges();
      }
      copyButton.textContent = "Copied";
      copyButton.classList.add("is-copied");
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        copyButton.textContent = "Copy";
        copyButton.classList.remove("is-copied");
      }, 2000);
    });
  }
})();

(() => {
  const form = document.querySelector("#waitlist-form");
  if (!form) return;

  const email = form.elements.email;
  const message = form.querySelector("#form-message");
  const submit = form.querySelector("button[type=submit]");

  const setMessage = (text, type = "") => {
    message.textContent = text;
    message.className = `form-message${type ? ` is-${type}` : ""}`;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.classList.contains("is-submitting") || form.dataset.submitted === "true") return;

    email.removeAttribute("aria-invalid");
    if (!email.value.trim()) {
      email.setAttribute("aria-invalid", "true");
      setMessage("Enter your work email to join the commercial waitlist.", "error");
      email.focus();
      return;
    }
    if (!email.validity.valid) {
      email.setAttribute("aria-invalid", "true");
      setMessage("Enter a valid work email address.", "error");
      email.focus();
      return;
    }

    const data = new FormData(form);
    const payload = {
      email: String(data.get("email") || "").trim(),
      name: String(data.get("name") || "").trim(),
      website: String(data.get("website") || "").trim(),
      source: "landing"
    };

    form.classList.add("is-submitting");
    form.setAttribute("aria-busy", "true");
    submit.disabled = true;
    setMessage("Sending your request…");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        throw new Error(typeof result.error === "string" ? result.error : "We could not save your request. Please try again.");
      }
      form.dataset.submitted = "true";
      form.elements.name.readOnly = true;
      email.readOnly = true;
      setMessage("You’re on the commercial edition waitlist. We’ll be in touch.", "success");
      submit.querySelector(".button-label").textContent = "You’re on the list";
    } catch (error) {
      submit.disabled = false;
      const text = error instanceof Error && error.name === "Error" ? error.message : "We could not save your request. Check your connection and try again.";
      setMessage(text, "error");
    } finally {
      form.classList.remove("is-submitting");
      form.removeAttribute("aria-busy");
    }
  });
})();
