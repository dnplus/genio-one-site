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
