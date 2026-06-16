const stage = document.getElementById("stage");
const progressEl = document.getElementById("progress");
const logoutButton = document.getElementById("logoutButton");
const editViewButton = document.getElementById("editViewButton");
const adminButton = document.getElementById("adminButton");
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
  current: 0,
  timer: null,
  progressStart: null,
  progressFrame: null,
  tiles: [],
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
      if (response.status === 413) {
        throw new Error(payload.message || "Arquivo muito grande. Use uma midia de ate 100 MB.");
      }

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

function readMediaFile(file) {
  if (!file) return Promise.resolve("");

  if (!/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/.test(file.type)) {
    return Promise.reject(new Error("Use PNG, JPG, WEBP, GIF, MP4 ou WEBM."));
  }

  if (file.size > 100 * 1024 * 1024) {
    return Promise.reject(new Error("Use uma midia de ate 100 MB."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Nao foi possivel ler a midia.")));
    reader.readAsDataURL(file);
  });
}

function isValidOptionalUrl(url) {
  if (!url) return true;

  try {
    const parsedUrl = new URL(url);
    return ["http:", "https:"].includes(parsedUrl.protocol);
  } catch (error) {
    return false;
  }
}

function normalizeDisplaySeconds(value, fallback = 10) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.min(Math.max(Math.round(seconds), 1), 3600);
}

function getSlideDuration(system) {
  return normalizeDisplaySeconds(system?.displaySeconds, state.slideDuration / 1000) * 1000;
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
      (system, index) => `
        <div class="visualization-option" data-system-id="${escapeHtml(system.id)}">
          <input
            type="checkbox"
            data-field="enabled"
            value="${escapeHtml(system.id)}"
            ${selected.has(String(system.id)) ? "checked" : ""}
            aria-label="Exibir ${escapeHtml(system.name)}"
          />
          <div class="visualization-option-fields">
            <div class="visualization-meta-fields">
              <label>
                <span>Ordem</span>
                <input
                  data-field="displayOrder"
                  type="number"
                  min="1"
                  value="${escapeHtml(system.position || index + 1)}"
                />
              </label>
              <label>
                <span>Tempo (s)</span>
                <input
                  data-field="displaySeconds"
                  type="number"
                  min="1"
                  max="3600"
                  value="${escapeHtml(system.displaySeconds || 10)}"
                />
              </label>
            </div>
            <input data-field="name" type="text" value="${escapeHtml(system.name)}" placeholder="Nome do sistema ou banner" />
            <input data-field="url" type="text" value="${escapeHtml(system.url)}" placeholder="Link opcional do sistema" />
            <input
              data-field="description"
              type="text"
              value="${escapeHtml(system.description || "")}"
              placeholder="Descricao opcional"
            />
            ${
              system.mediaUrl
                ? String(system.mediaType || "").startsWith("video/")
                  ? `<video class="image-preview" src="${escapeHtml(system.mediaUrl)}" muted loop playsinline></video>`
                  : `<img class="image-preview" src="${escapeHtml(system.mediaUrl)}" alt="${escapeHtml(system.name)}" />`
                : ""
            }
            <input data-field="media" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" />
            ${
              system.mediaUrl
                ? `
                  <label class="image-remove-label">
                    <input data-field="removeMedia" type="checkbox" />
                    Remover midia atual
                  </label>
                `
                : ""
            }
          </div>
          <button
            class="remove-system-button"
            type="button"
            data-action="remove-system"
            aria-label="Excluir ${escapeHtml(system.name)}"
          >
            Excluir
          </button>
        </div>
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
  state.tiles = [];

  systems.forEach((system, index) => {
    const tile = document.createElement("section");
    tile.className = "tv-tile";

    if (system.mediaUrl) {
      if (String(system.mediaType || "").startsWith("video/")) {
        const video = document.createElement("video");
        video.src = system.mediaUrl;
        video.className = "tv-media";
        video.muted = true;
        video.loop = false;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = "auto";
        video.addEventListener("ended", () => {
          if (!state.isPaused && !state.isEditing && state.tiles[state.current] === tile) {
            advanceSlide();
          }
        });
        tile.appendChild(video);
      } else {
        const image = document.createElement("img");
        image.src = system.mediaUrl;
        image.alt = system.name;
        image.className = "tv-image";
        tile.appendChild(image);
      }
    } else if (system.url) {
      const iframe = document.createElement("iframe");
      iframe.src = system.url;
      iframe.title = system.name;
      iframe.loading = "lazy";
      tile.appendChild(iframe);
    } else {
      tile.appendChild(createPlaceholder(system.name, system.description || "Link ou midia ainda nao configurado."));
    }

    stage.appendChild(tile);
    state.tiles.push(tile);
  });
}

function restartSlideshow() {
  clearTimeout(state.timer);
  resetProgress();
  renderSystems();
  state.current = 0;
  showSlide(0);
  startSlideshow();
}

function stopInactiveVideos() {
  state.tiles.forEach((tile, tileIndex) => {
    const video = tile.querySelector("video");
    if (!video || tileIndex === state.current) return;

    video.pause();
    try {
      video.currentTime = 0;
    } catch (error) {}
  });
}

function showSlide(index) {
  if (!state.tiles.length) return;

  state.current = ((index % state.tiles.length) + state.tiles.length) % state.tiles.length;
  state.tiles.forEach((tile, tileIndex) => {
    tile.classList.toggle("is-active", tileIndex === state.current);
  });

  stopInactiveVideos();
}

function startProgress(durationMs) {
  cancelAnimationFrame(state.progressFrame);
  state.progressStart = performance.now();

  const tick = (now) => {
    const elapsed = now - state.progressStart;
    const percent = Math.min((elapsed / durationMs) * 100, 100);
    progressEl.style.width = `${percent}%`;
    if (percent < 100 && !state.isPaused && !state.isEditing) {
      state.progressFrame = requestAnimationFrame(tick);
    }
  };

  state.progressFrame = requestAnimationFrame(tick);
}

function startVideoProgress(video) {
  cancelAnimationFrame(state.progressFrame);

  const tick = () => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      progressEl.style.width = `${Math.min((video.currentTime / video.duration) * 100, 100)}%`;
    } else {
      progressEl.style.width = "0%";
    }

    if (!video.ended && !state.isPaused && !state.isEditing) {
      state.progressFrame = requestAnimationFrame(tick);
    }
  };

  state.progressFrame = requestAnimationFrame(tick);
}

function resetProgress() {
  cancelAnimationFrame(state.progressFrame);
  progressEl.style.width = "0%";
}

function scheduleActiveSlide() {
  clearTimeout(state.timer);
  resetProgress();

  const activeTile = state.tiles[state.current];
  const activeSystem = state.systems[state.current];
  if (!activeTile) return;

  const video = activeTile.querySelector("video");
  if (video) {
    try {
      video.currentTime = 0;
    } catch (error) {}
    startVideoProgress(video);
    Promise.resolve(video.play()).catch(() => {
      const fallbackDuration = getSlideDuration(activeSystem);
      startProgress(fallbackDuration);
      state.timer = setTimeout(advanceSlide, fallbackDuration);
    });
    return;
  }

  const duration = getSlideDuration(activeSystem);
  startProgress(duration);
  state.timer = setTimeout(advanceSlide, duration);
}

function advanceSlide() {
  if (state.isPaused || state.isEditing || !state.tiles.length) return;

  showSlide(state.current + 1);
  scheduleActiveSlide();
}

function startSlideshow() {
  state.isPaused = false;
  clearTimeout(state.timer);
  showSlide(state.current);
  scheduleActiveSlide();
}

function pauseSlideshow() {
  if (state.isPaused) return;
  state.isPaused = true;
  clearTimeout(state.timer);
  const activeVideo = state.tiles[state.current]?.querySelector("video");
  if (activeVideo) activeVideo.pause();
  resetProgress();
}

function openVisualizationModal() {
  state.isEditing = true;
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

function getCheckedVisualizationIds() {
  return Array.from(visualizationOptions.querySelectorAll(".visualization-option[data-system-id]"))
    .map((row, index) => ({
      id: row.dataset.systemId,
      enabled: row.querySelector('[data-field="enabled"]').checked,
      order: Number(row.querySelector('[data-field="displayOrder"]').value || index + 1),
      index,
    }))
    .filter((item) => item.enabled)
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map((item) => item.id);
}

async function saveEditedSystems() {
  const rows = Array.from(visualizationOptions.querySelectorAll(".visualization-option[data-system-id]"));

  for (const row of rows) {
    const id = String(row.dataset.systemId);
    const original = state.availableSystems.find((system) => String(system.id) === id);
    if (!original) continue;

    const name = row.querySelector('[data-field="name"]').value.trim();
    const url = row.querySelector('[data-field="url"]').value.trim();
    const description = row.querySelector('[data-field="description"]').value.trim();
    const displaySeconds = normalizeDisplaySeconds(row.querySelector('[data-field="displaySeconds"]').value);
    const mediaFile = row.querySelector('[data-field="media"]').files[0];
    const removeMedia = Boolean(row.querySelector('[data-field="removeMedia"]')?.checked);
    const mediaData = await readMediaFile(mediaFile);
    const keepsMedia = Boolean(original.mediaUrl) && !removeMedia;

    if (!name || (!url && !mediaData && !keepsMedia)) {
      throw new Error("Preencha nome e link ou selecione uma midia.");
    }

    if (!isValidOptionalUrl(url)) {
      throw new Error("Use um link iniciado com http ou https.");
    }

    const changed =
      name !== original.name ||
      url !== original.url ||
      description !== (original.description || "") ||
      displaySeconds !== normalizeDisplaySeconds(original.displaySeconds) ||
      Boolean(mediaData) ||
      removeMedia;

    if (!changed) continue;

    await fetchJson(`/api/panel/systems/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, url, description, displaySeconds, mediaData, removeMedia }),
    });
  }
}

async function saveVisualizationSelection(selectedIds) {
  if (!state.user || !state.user.secretariaId) return;

  await fetchJson("/api/panel/systems/selection", {
    method: "PUT",
    body: JSON.stringify({ systemIds: selectedIds }),
  });
}

async function refreshPanelSystems() {
  const panelData = await fetchJson("/api/panel/config");
  state.availableSystems = panelData.systems;
}

function syncSelectedSystemsAfterRefresh(previouslySelectedIds) {
  const availableIds = new Set(state.availableSystems.map((system) => String(system.id)));
  state.selectedSystemIds = previouslySelectedIds.filter((id) => availableIds.has(String(id)));
  state.systems = getVisibleSystems();
  state.current = 0;
}

async function applyVisualization() {
  const checkedIds = getCheckedVisualizationIds();
  if (!checkedIds.length && state.availableSystems.length) {
    visualizationMessage.textContent = "Selecione pelo menos um sistema.";
    return;
  }

  try {
    applyVisualizationButton.disabled = true;
    visualizationMessage.textContent = "";
    await saveEditedSystems();
    await saveVisualizationSelection(checkedIds);
    await refreshPanelSystems();

    syncSelectedSystemsAfterRefresh(checkedIds);
    closeVisualizationModal(false);
    restartSlideshow();
  } catch (error) {
    visualizationMessage.style.color = "#a5264c";
    visualizationMessage.textContent = error.message;
  } finally {
    applyVisualizationButton.disabled = false;
  }
}

async function removeSystem(systemId) {
  const system = state.availableSystems.find((item) => String(item.id) === String(systemId));
  if (!system) return;

  const shouldRemove = window.confirm(`Excluir "${system.name}" da visualizacao?`);
  if (!shouldRemove) return;

  try {
    visualizationMessage.textContent = "";
    const checkedIds = getCheckedVisualizationIds().filter((id) => String(id) !== String(systemId));
    const payload = await fetchJson(`/api/panel/systems/${systemId}`, { method: "DELETE" });

    state.availableSystems = payload.systems;
    syncSelectedSystemsAfterRefresh(checkedIds);
    renderVisualizationOptions();
    restartSlideshow();
    pauseSlideshow();
    visualizationMessage.style.color = "#0f5d8f";
    visualizationMessage.textContent = "Sistema excluido.";
  } catch (error) {
    visualizationMessage.style.color = "#a5264c";
    visualizationMessage.textContent = error.message;
  }
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
  const checkedIds = getCheckedVisualizationIds();
  const displaySeconds = normalizeDisplaySeconds(formData.get("displaySeconds"));

  try {
    const mediaData = await readMediaFile(formData.get("media"));

    if (!name || (!url && !mediaData)) {
      throw new Error("Preencha nome e link ou selecione uma midia.");
    }

    if (!isValidOptionalUrl(url)) {
      throw new Error("Use um link iniciado com http ou https.");
    }

    const payload = await fetchJson("/api/panel/systems", {
      method: "POST",
      body: JSON.stringify({ name, url, displaySeconds, mediaData }),
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
  const keepFullscreenReady = () => {
    requestFullscreen();
  };

  document.addEventListener("pointerdown", keepFullscreenReady, { passive: true });
  document.addEventListener("keydown", keepFullscreenReady);
  document.addEventListener(
    "mousemove",
    (event) => {
      if (event.clientY <= 110) {
        showControls();
      }
    },
    { passive: true }
  );
  controlsRevealZone.addEventListener("pointerenter", showControls);
  controlsRevealZone.addEventListener("pointermove", showControls);
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

    if (state.user.role === "admin") {
      adminButton.classList.remove("is-hidden");
    }

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

adminButton.addEventListener("click", () => {
  window.location.href = "/admin";
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

visualizationOptions.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="remove-system"]');
  if (!button) return;

  const row = button.closest(".visualization-option[data-system-id]");
  if (!row) return;

  removeSystem(row.dataset.systemId);
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
