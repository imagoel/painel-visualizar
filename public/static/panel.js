const stage = document.getElementById("stage");
const dotsEl = document.getElementById("dots");
const progressEl = document.getElementById("progress");
const logoutButton = document.getElementById("logoutButton");
const editViewButton = document.getElementById("editViewButton");
const controlsRevealZone = document.getElementById("controlsRevealZone");
const visualizationModal = document.getElementById("visualizationModal");
const visualizationOptions = document.getElementById("visualizationOptions");
const visualizationMessage = document.getElementById("visualizationMessage");
const closeVisualizationButton = document.getElementById("closeVisualizationButton");
const cancelVisualizationButton = document.getElementById("cancelVisualizationButton");
const applyVisualizationButton = document.getElementById("applyVisualizationButton");
const addSystemForm = document.getElementById("addSystemForm");

const state = {
  user: null,
  availableSystems: [],
  systems: [],
  selectedSystemIds: [],
  slideDuration: 30000,
  inactivityTimeout: 30000,
  current: 0,
  timer: null,
  inactivityTimer: null,
  progressStart: null,
  progressFrame: null,
  tiles: [],
  dots: [],
  isPaused: false,
  isEditing: false,
  controlsTimer: null,
};

function fetchJson(url, options = {}) {
  return fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  }).then(async (response) => {
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(payload.message || "Nao foi possivel concluir a requisicao.");
    }

    return payload;
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requestFullscreen() {
  const element = document.documentElement;
  const fn =
    element.requestFullscreen ||
    element.webkitRequestFullscreen ||
    element.mozRequestFullScreen ||
    element.msRequestFullscreen;

  if (fn) {
    Promise.resolve(fn.call(element)).catch(() => {});
  }
}

function setupInitialFullscreen() {
  const retryFullscreen = () => {
    requestFullscreen();
    document.removeEventListener("pointerdown", retryFullscreen);
    document.removeEventListener("keydown", retryFullscreen);
  };

  requestFullscreen();
  document.addEventListener("pointerdown", retryFullscreen, { passive: true });
  document.addEventListener("keydown", retryFullscreen);
}

function createPlaceholder(title, message) {
  const wrapper = document.createElement("div");
  wrapper.className = "tv-placeholder";
  wrapper.innerHTML = `
    <div class="tv-placeholder-card">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  return wrapper;
}

function getVisibleSystems() {
  const selected = new Set(state.selectedSystemIds.map(String));
  return state.availableSystems.filter((system) => selected.has(String(system.id)));
}

function renderVisualizationOptions() {
  visualizationMessage.textContent = "";
  visualizationMessage.style.color = "#a5264c";

  if (!state.availableSystems.length) {
    visualizationOptions.innerHTML = `
      <div class="visualization-option">
        <span></span>
        <strong>Nenhum sistema liberado</strong>
      </div>
    `;
    return;
  }

  const selected = new Set(state.selectedSystemIds.map(String));
  visualizationOptions.innerHTML = state.availableSystems
    .map(
      (system) => `
        <label class="visualization-option">
          <input type="checkbox" value="${escapeHtml(system.id)}" ${selected.has(String(system.id)) ? "checked" : ""} />
          <span>
            <strong>${escapeHtml(system.name)}</strong>
            <small>${escapeHtml(system.description || "Sistema disponivel")}</small>
          </span>
        </label>
      `
    )
    .join("");
}

function renderSystems() {
  const systems = state.systems.length
    ? state.systems
    : [
        {
          id: "sem-acesso",
          name: "Sem sistemas liberados",
          description: "Este usuario ainda nao possui sistemas vinculados.",
          url: "",
        },
      ];

  stage.innerHTML = "";
  dotsEl.innerHTML = "";
  state.tiles = [];
  state.dots = [];

  systems.forEach((system, index) => {
    const tile = document.createElement("section");
    tile.className = "tv-tile";

    if (system.url) {
      const iframe = document.createElement("iframe");
      iframe.src = system.url;
      iframe.title = system.name;
      iframe.loading = "lazy";
      tile.appendChild(iframe);
    } else {
      tile.appendChild(createPlaceholder(system.name, system.description || "Link ainda nao configurado."));
    }

    stage.appendChild(tile);
    state.tiles.push(tile);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "tv-dot";
    dot.title = system.name;
    dot.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      pauseSlideshow();
      showSlide(index);
      resetInactivity();
    });

    dotsEl.appendChild(dot);
    state.dots.push(dot);
  });
}

function restartSlideshow() {
  clearInterval(state.timer);
  resetProgress();
  renderSystems();
  showSlide(0);
  startSlideshow();
}

function showSlide(index) {
  state.current = ((index % state.tiles.length) + state.tiles.length) % state.tiles.length;
  state.tiles.forEach((tile, tileIndex) => {
    tile.classList.toggle("is-active", tileIndex === state.current);
  });
  state.dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === state.current);
  });
}

function startProgress() {
  cancelAnimationFrame(state.progressFrame);
  state.progressStart = performance.now();

  const tick = (now) => {
    const elapsed = now - state.progressStart;
    const percent = Math.min((elapsed / state.slideDuration) * 100, 100);
    progressEl.style.width = `${percent}%`;
    if (percent < 100) {
      state.progressFrame = requestAnimationFrame(tick);
    }
  };

  state.progressFrame = requestAnimationFrame(tick);
}

function resetProgress() {
  cancelAnimationFrame(state.progressFrame);
  progressEl.style.width = "0%";
}

function startSlideshow() {
  state.isPaused = false;
  clearInterval(state.timer);
  showSlide(state.current);
  startProgress();

  state.timer = setInterval(() => {
    state.current = (state.current + 1) % state.tiles.length;
    showSlide(state.current);
    startProgress();
  }, state.slideDuration);
}

function pauseSlideshow() {
  if (state.isPaused) return;
  state.isPaused = true;
  clearInterval(state.timer);
  resetProgress();
}

function resetInactivity() {
  if (state.isEditing) return;

  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = setTimeout(() => {
    startSlideshow();
  }, state.inactivityTimeout);
}

function openVisualizationModal() {
  state.isEditing = true;
  clearTimeout(state.inactivityTimer);
  pauseSlideshow();
  renderVisualizationOptions();
  visualizationModal.classList.remove("is-hidden");
  applyVisualizationButton.focus();
}

function closeVisualizationModal(shouldResume = true) {
  state.isEditing = false;
  visualizationModal.classList.add("is-hidden");
  visualizationMessage.textContent = "";
  visualizationMessage.style.color = "#a5264c";

  if (shouldResume) {
    startSlideshow();
  }

  showControls();
}

function applyVisualization() {
  const checkedIds = Array.from(visualizationOptions.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.value
  );

  if (!checkedIds.length && state.availableSystems.length) {
    visualizationMessage.textContent = "Selecione pelo menos um sistema.";
    return;
  }

  state.selectedSystemIds = checkedIds;
  state.systems = getVisibleSystems();
  state.current = 0;
  closeVisualizationModal(false);
  restartSlideshow();
}

function showControls() {
  document.querySelector(".panel-topbar").classList.remove("is-hidden");
  clearTimeout(state.controlsTimer);

  state.controlsTimer = setTimeout(() => {
    if (!state.isEditing) {
      document.querySelector(".panel-topbar").classList.add("is-hidden");
    }
  }, 4500);
}

async function addSystem(event) {
  event.preventDefault();
  visualizationMessage.textContent = "";

  const formData = new FormData(addSystemForm);
  const name = String(formData.get("name") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const checkedIds = Array.from(visualizationOptions.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.value
  );

  try {
    const payload = await fetchJson("/api/panel/systems", {
      method: "POST",
      body: JSON.stringify({ name, url }),
    });

    state.availableSystems = payload.systems;
    state.selectedSystemIds = Array.from(new Set([...checkedIds, String(payload.system.id)]));
    state.systems = getVisibleSystems();
    state.current = 0;

    addSystemForm.reset();
    renderVisualizationOptions();
    restartSlideshow();
    pauseSlideshow();
    visualizationMessage.style.color = "#0f5d8f";
    visualizationMessage.textContent = "Sistema adicionado.";
  } catch (error) {
    visualizationMessage.style.color = "#a5264c";
    visualizationMessage.textContent = error.message;
  }
}

function registerInteractions() {
  const onUserInteraction = () => {
    pauseSlideshow();
    resetInactivity();
  };

  document.addEventListener("pointerdown", onUserInteraction, { passive: true });
  document.addEventListener(
    "mousemove",
    (event) => {
      onUserInteraction();
      if (event.clientY <= 110) {
        showControls();
      }
    },
    { passive: true }
  );
  document.addEventListener("keydown", onUserInteraction);
  controlsRevealZone.addEventListener("pointerenter", showControls);
  controlsRevealZone.addEventListener("pointermove", showControls);

  let hadFocus = true;
  setInterval(() => {
    const hasFocusNow = document.hasFocus();
    if (hadFocus && !hasFocusNow) {
      onUserInteraction();
    }
    hadFocus = hasFocusNow;
  }, 500);

  document.addEventListener("keydown", (event) => {
    if (state.isEditing) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const shortcut = Number(event.key);
    if (!Number.isInteger(shortcut) || shortcut < 1 || shortcut > state.tiles.length) {
      return;
    }

    pauseSlideshow();
    showSlide(shortcut - 1);
    resetInactivity();
  });
}

async function bootstrap() {
  try {
    const sessionData = await fetchJson("/api/auth/me");
    const panelData = await fetchJson("/api/panel/config");

    state.user = sessionData.user;
    state.availableSystems = panelData.systems;
    state.selectedSystemIds = state.availableSystems.map((system) => String(system.id));
    state.systems = getVisibleSystems();
    state.slideDuration = panelData.settings.slideDuration;
    state.inactivityTimeout = panelData.settings.inactivityTimeout;

    renderSystems();
    showSlide(0);
    startSlideshow();
    registerInteractions();
    setupInitialFullscreen();
    showControls();
  } catch (error) {
    window.location.href = "/login";
  }
}

logoutButton.addEventListener("click", async () => {
  await fetchJson("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.href = "/login";
});

editViewButton.addEventListener("click", () => {
  openVisualizationModal();
});

closeVisualizationButton.addEventListener("click", () => {
  closeVisualizationModal();
});

cancelVisualizationButton.addEventListener("click", () => {
  closeVisualizationModal();
});

applyVisualizationButton.addEventListener("click", () => {
  applyVisualization();
});

addSystemForm.addEventListener("submit", (event) => {
  addSystem(event);
});

visualizationModal.addEventListener("pointerdown", (event) => {
  if (event.target === visualizationModal) {
    closeVisualizationModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !visualizationModal.classList.contains("is-hidden")) {
    closeVisualizationModal();
  }
});

bootstrap();
