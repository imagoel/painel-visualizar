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

const appShell = document.querySelector(".app-shell");
const systemsGrid = document.querySelector("#systemsGrid");
const viewerTitle = document.querySelector("#viewerTitle");
const framesContainer = document.querySelector("#framesContainer");
const fullscreenToggle = document.querySelector("#fullscreenToggle");
const viewModeSingle = document.querySelector("#viewModeSingle");
const viewModeMulti = document.querySelector("#viewModeMulti");

let activeSystemId = systems[0]?.id ?? "";
let isMultiView = true;

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

const updateUiState = () => {
  const cards = systemsGrid.querySelectorAll(".system-card");
  cards.forEach((card) => {
    const selected = !isMultiView && card.dataset.system === activeSystemId;
    card.classList.toggle("is-active", selected);
    card.setAttribute("aria-pressed", String(selected));
  });

  viewModeSingle.classList.toggle("is-active", !isMultiView);
  viewModeMulti.classList.toggle("is-active", isMultiView);
};

const renderSystem = (systemId) => {
  const system = systemById(systemId);
  if (!system) return;

  isMultiView = false;
  activeSystemId = system.id;
  viewerTitle.textContent = system.name;

  framesContainer.className = "frame-shell";
  framesContainer.innerHTML = "";

  const url = isValidUrl(system.url) ? system.url : "about:blank";
  const iframe = createFrame(url, `Visualizacao do sistema ${system.name}`, "systemFrame");
  framesContainer.appendChild(iframe);

  updateUiState();
};

const createMultiTile = (system) => {
  const tile = document.createElement("section");
  tile.className = "multi-tile";

  const head = document.createElement("div");
  head.className = "multi-tile-head";
  head.textContent = system.name;
  tile.appendChild(head);

  if (isValidUrl(system.url)) {
    const iframe = createFrame(system.url, `Visualizacao do sistema ${system.name}`);
    tile.appendChild(iframe);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "multi-placeholder";
    placeholder.textContent = "Link ainda nao configurado";
    tile.appendChild(placeholder);
  }

  return tile;
};

const renderMultiView = () => {
  isMultiView = true;
  viewerTitle.textContent = "3 sistemas simultaneos";

  framesContainer.className = "frame-shell multi-frame-grid";
  framesContainer.innerHTML = "";

  systems.forEach((system) => {
    framesContainer.appendChild(createMultiTile(system));
  });

  updateUiState();
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
  viewModeSingle.addEventListener("click", () => {
    if (!isMultiView) return;
    renderSystem(activeSystemId);
  });

  viewModeMulti.addEventListener("click", () => {
    if (isMultiView) return;
    renderMultiView();
  });
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

const requestFullscreenOnShell = async () => {
  if (document.fullscreenElement === appShell) return true;

  try {
    await appShell.requestFullscreen();
    return true;
  } catch (error) {
    return false;
  }
};

const setupInitialFullscreen = () => {
  const onInteraction = async () => {
    await requestFullscreenOnShell();
  };

  requestFullscreenOnShell().then((ok) => {
    if (ok) return;

    document.addEventListener("pointerdown", onInteraction, { once: true });
    document.addEventListener("keydown", onInteraction, { once: true });
  });
};

const setupFullscreen = () => {
  const updateFullscreenLabel = () => {
    const isFullscreen = document.fullscreenElement === appShell;
    fullscreenToggle.textContent = isFullscreen ? "Sair da tela cheia" : "Tela cheia";
  };

  fullscreenToggle.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === appShell) {
        await document.exitFullscreen();
      } else {
        await appShell.requestFullscreen();
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
renderMultiView();
setupInitialFullscreen();
