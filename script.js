(() => {
  "use strict";

  const STORAGE_KEY = "diario-de-bordo:entries";

  const form = document.getElementById("entryForm");
  const titleInput = document.getElementById("entryTitle");
  const dateInput = document.getElementById("entryDate");
  const descriptionInput = document.getElementById("entryDescription");
  const formError = document.getElementById("formError");

  const entryList = document.getElementById("entryList");
  const entryCount = document.getElementById("entryCount");
  const emptyState = document.getElementById("emptyState");

  const connectionStatus = document.getElementById("connectionStatus");
  const installButton = document.getElementById("installButton");
  const toast = document.getElementById("toast");

  const MONTHS = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];

  // ------------------------------------------------------------
  // Persistence (localStorage)
  // ------------------------------------------------------------

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Não foi possível ler as entradas salvas:", err);
      return [];
    }
  }

  function saveEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch (err) {
      console.error("Não foi possível salvar as entradas:", err);
      showToast("Não foi possível salvar. O armazenamento local pode estar cheio.");
      return false;
    }
  }

  let entries = loadEntries();

  // ------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------

  function formatDate(isoDate) {
    // isoDate is "YYYY-MM-DD"; parse manually to avoid timezone shifts.
    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) return { day: "--", rest: isoDate };
    return {
      day: String(day).padStart(2, "0"),
      rest: `${MONTHS[month - 1]} ${year}`,
    };
  }

  function render() {
    entryList.innerHTML = "";

    const sorted = [...entries].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    for (const entry of sorted) {
      entryList.appendChild(renderEntry(entry));
    }

    entryCount.textContent = String(entries.length);
    emptyState.hidden = entries.length > 0;
  }

  function renderEntry(entry) {
    const { day, rest } = formatDate(entry.date);

    const li = document.createElement("li");
    li.className = "entry";
    li.dataset.id = entry.id;

    const dateEl = document.createElement("div");
    dateEl.className = "entry__date";
    dateEl.innerHTML = `
      <span class="entry__date-day">${day}</span>
      <span class="entry__date-rest">${escapeHtml(rest)}</span>
    `;

    const bodyEl = document.createElement("div");
    const titleEl = document.createElement("h3");
    titleEl.className = "entry__title";
    titleEl.textContent = entry.title;
    bodyEl.appendChild(titleEl);

    if (entry.description) {
      const descEl = document.createElement("p");
      descEl.className = "entry__description";
      descEl.textContent = entry.description;
      bodyEl.appendChild(descEl);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "entry__remove";
    removeBtn.textContent = "Remover";
    removeBtn.setAttribute("aria-label", `Remover entrada "${entry.title}"`);
    removeBtn.addEventListener("click", () => removeEntry(entry.id));

    li.append(dateEl, bodyEl, removeBtn);
    return li;
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  // ------------------------------------------------------------
  // CRUD actions
  // ------------------------------------------------------------

  function addEntry({ title, date, description }) {
    const entry = {
      id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2),
      title: title.trim(),
      date,
      description: description.trim(),
      createdAt: Date.now(),
    };
    entries.push(entry);
    if (saveEntries(entries)) {
      render();
      showToast("Entrada registrada.");
    }
  }

  function removeEntry(id) {
    const entry = entries.find((item) => item.id === id);
    entries = entries.filter((item) => item.id !== id);
    if (saveEntries(entries)) {
      render();
      showToast(entry ? `"${entry.title}" foi removida.` : "Entrada removida.");
    }
  }

  // ------------------------------------------------------------
  // Form handling
  // ------------------------------------------------------------

  function setDefaultDate() {
    if (dateInput.value) return;
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    dateInput.value = iso;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const date = dateInput.value;
    const description = descriptionInput.value.trim();

    if (!title || !date) {
      formError.textContent = "Preencha ao menos o título e a data para registrar a entrada.";
      formError.hidden = false;
      return;
    }

    formError.hidden = true;
    addEntry({ title, date, description });

    form.reset();
    setDefaultDate();
    titleInput.focus();
  });

  // ------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------

  let toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  // ------------------------------------------------------------
  // Connection status
  // ------------------------------------------------------------

  function updateConnectionStatus() {
    const online = navigator.onLine;
    connectionStatus.classList.toggle("is-offline", !online);
    connectionStatus.querySelector(".status__label").textContent = online ? "Online" : "Offline";
    if (!online) {
      showToast("Você está offline. As entradas continuam sendo salvas neste dispositivo.");
    }
  }

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);

  // ------------------------------------------------------------
  // Install prompt (beforeinstallprompt)
  // ------------------------------------------------------------

  let deferredInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    installButton.disabled = true;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
    installButton.disabled = false;
    if (outcome === "accepted") {
      showToast("Aplicativo instalado.");
    }
  });

  window.addEventListener("appinstalled", () => {
    installButton.hidden = true;
    deferredInstallPrompt = null;
  });

  // ------------------------------------------------------------
  // Service worker registration
  // ------------------------------------------------------------

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .catch((err) => console.error("Falha ao registrar o service worker:", err));
    });
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------

  setDefaultDate();
  updateConnectionStatus();
  render();
})();
