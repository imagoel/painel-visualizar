const systems = [
  {
    id: "c2",
    name: "C2",
    subtitle: "Sistema principal",
    url: "http://10.75.2.15:8020/",
    logo: "assets/logo.png",
  },
  {
    id: "sistema-2",
    name: "Sistema 2",
    subtitle: "Aguardando link final",
    url: "",
    logo: "",
  },
  {
    id: "sistema-3",
    name: "Sistema 3",
    subtitle: "Aguardando link final",
    url: "",
    logo: "",
  },
];

const systemsGrid = document.querySelector("#systemsGrid");
const viewerTitle = document.querySelector("#viewerTitle");
const framesContainer = document.querySelector("#framesContainer");
const openExternalLink = document.querySelector("#openExternalLink");
const fullscreenToggle = document.querySelector("#fullscreenToggle");
const viewModeSingle = document.querySelector("#viewModeSingle");
const viewModeMulti = document.querySelector("#viewModeMulti");
const layoutToggle = document.querySelector("#layoutToggle");
const layoutRow = document.querySelector("#layoutRow");
const layoutCol = document.querySelector("#layoutCol");

let activeSystemId = systems[0]?.id ?? "";
let isMultiView = false;
let multiLayout = "row";

const isValidUrl = (value) => /^https?:\/\/.+/i.test(value.trim());

const fallbackInitials = (name) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");

const systemById = (id) => systems.find((system) => system.id === id);

const createFrame = (url, title, id = "") => {
  const iframe = document.createElement("iframe");
  if (id) iframe.id = id;
  iframe.title = title;
  iframe.loading = "lazy";
  iframe.src = url;
  return iframe;
};

const updateLayoutButtons = () => {
  if (layoutRow) {
    layoutRow.classList.toggle("is-active", multiLayout === "row");
  }
  if (layoutCol) {
    layoutCol.classList.toggle("is-active", multiLayout === "col");
  }

  if (framesContainer.classList.contains("multi-frame-grid")) {
    framesContainer.classList.toggle("layout-row", multiLayout === "row");
    framesContainer.classList.toggle("layout-col", multiLayout === "col");
  }
};

const updateButtons = () => {
  const cards = systemsGrid.querySelectorAll(".system-card");
  cards.forEach((card) => {
    const selected = !isMultiView && card.dataset.system === activeSystemId;
    card.classList.toggle("is-active", selected);
    card.setAttribute("aria-pressed", String(selected));
  });

  if (viewModeSingle) {
    viewModeSingle.classList.toggle("is-active", !isMultiView);
  }
  if (viewModeMulti) {
    viewModeMulti.classList.toggle("is-active", isMultiView);
  }
  if (layoutToggle) {
    layoutToggle.style.display = isMultiView ? "inline-flex" : "none";
  }
};

const setOpenLink = (url) => {
  if (isMultiView) {
    openExternalLink.href = "#";
    openExternalLink.classList.add("is-disabled");
    openExternalLink.setAttribute("aria-disabled", "true");
    return;
  }

  if (isValidUrl(url)) {
    openExternalLink.href = url;
    openExternalLink.classList.remove("is-disabled");
    openExternalLink.setAttribute("aria-disabled", "false");
    return;
  }

  openExternalLink.href = "#";
  openExternalLink.classList.add("is-disabled");
  openExternalLink.setAttribute("aria-disabled", "true");
};

const renderSystem = (systemId) => {
  isMultiView = false;
  const system = systemById(systemId);
  if (!system) return;

  activeSystemId = system.id;
  viewerTitle.textContent = system.name;

  framesContainer.className = "frame-shell";
  framesContainer.innerHTML = "";

  const url = isValidUrl(system.url) ? system.url : "about:blank";
  const iframe = createFrame(url, `Visualizacao do sistema ${system.name}`, "systemFrame");
  framesContainer.appendChild(iframe);

  updateButtons();
  setOpenLink(system.url);
};

const renderMultiView = () => {
  isMultiView = true;
  viewerTitle.textContent = "Vis\u00E3o Simult\u00E2nea";

  framesContainer.className = `frame-shell multi-frame-grid layout-${multiLayout}`;
  framesContainer.innerHTML = "";

  const readySystems = systems.filter((system) => isValidUrl(system.url));
  if (readySystems.length === 0) {
    const message = document.createElement("p");
    message.style.padding = "2rem";
    message.style.textAlign = "center";
    message.style.color = "var(--muted)";
    message.textContent = "Nenhum sistema configurado para exibi\u00E7\u00E3o simult\u00E2nea.";
    framesContainer.appendChild(message);
  } else {
    readySystems.forEach((system) => {
      const iframe = createFrame(system.url, `Visualizacao do sistema ${system.name}`);
      framesContainer.appendChild(iframe);
    });
  }

  updateButtons();
  updateLayoutButtons();
  setOpenLink("");
};

const cardTemplate = (system) => {
  const isReady = isValidUrl(system.url);
  const iconMarkup = system.logo
    ? `<img class="card-icon" src="${system.logo}" alt="Logo ${system.name}" />`
    : `<span class="card-fallback" aria-hidden="true">${fallbackInitials(system.name)}</span>`;

  return `
    <button class="system-card" type="button" data-system="${system.id}" aria-pressed="false">
      ${iconMarkup}
      <span class="card-copy">
        <h3>${system.name}</h3>
        <p>${system.subtitle}</p>
        <span class="card-tag ${isReady ? "is-ready" : "is-waiting"}">
          ${isReady ? "Link configurado" : "Em preparacao"}
        </span>
      </span>
    </button>
  `;
};

const renderCards = () => {
  systemsGrid.innerHTML = systems.map(cardTemplate).join("");
  systemsGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".system-card");
    if (!button) return;
    renderSystem(button.dataset.system);
  });
};

const setupViewToggle = () => {
  if (viewModeSingle) {
    viewModeSingle.addEventListener("click", () => {
      if (!isMultiView) return;
      renderSystem(activeSystemId);
    });
  }

  if (viewModeMulti) {
    viewModeMulti.addEventListener("click", () => {
      if (isMultiView) return;
      renderMultiView();
    });
  }

  if (layoutRow) {
    layoutRow.addEventListener("click", () => {
      multiLayout = "row";
      updateLayoutButtons();
    });
  }

  if (layoutCol) {
    layoutCol.addEventListener("click", () => {
      multiLayout = "col";
      updateLayoutButtons();
    });
  }
};

const setupKeyboardShortcuts = () => {
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const targetTag = document.activeElement?.tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") {
      return;
    }

    const shortcut = Number(event.key);
    if (!Number.isInteger(shortcut) || shortcut < 1 || shortcut > systems.length) return;

    const system = systems[shortcut - 1];
    if (!system) return;

    renderSystem(system.id);
    const button = systemsGrid.querySelector(`[data-system="${system.id}"]`);
    button?.focus();
  });
};

const setupFullscreen = () => {
  const updateFullscreenLabel = () => {
    const isFullscreen = document.fullscreenElement === framesContainer;
    fullscreenToggle.textContent = isFullscreen ? "Sair da tela cheia" : "Tela cheia";
  };

  fullscreenToggle.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === framesContainer) {
        await document.exitFullscreen();
      } else {
        await framesContainer.requestFullscreen();
      }
    } catch (error) {
      console.warn("Tela cheia nao disponivel neste navegador.", error);
    }
    updateFullscreenLabel();
  });

  document.addEventListener("fullscreenchange", updateFullscreenLabel);
  updateFullscreenLabel();
};

renderCards();
setupKeyboardShortcuts();
setupViewToggle();
setupFullscreen();
renderSystem(activeSystemId);
