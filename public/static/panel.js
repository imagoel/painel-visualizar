const stage = document.getElementById("stage");
const dotsEl = document.getElementById("dots");
const progressEl = document.getElementById("progress");
const logoutButton = document.getElementById("logoutButton");
const adminButton = document.getElementById("adminButton");
const panelTitle = document.getElementById("panelTitle");

const state = {
  user: null,
  systems: [],
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
  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = setTimeout(() => {
    startSlideshow();
  }, state.inactivityTimeout);
}

function registerInteractions() {
  const onUserInteraction = () => {
    pauseSlideshow();
    resetInactivity();
  };

  document.addEventListener("pointerdown", onUserInteraction, { passive: true });
  document.addEventListener("mousemove", onUserInteraction, { passive: true });
  document.addEventListener("keydown", onUserInteraction);

  let hadFocus = true;
  setInterval(() => {
    const hasFocusNow = document.hasFocus();
    if (hadFocus && !hasFocusNow) {
      onUserInteraction();
    }
    hadFocus = hasFocusNow;
  }, 500);

  document.addEventListener("keydown", (event) => {
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
    state.systems = panelData.systems;
    state.slideDuration = panelData.settings.slideDuration;
    state.inactivityTimeout = panelData.settings.inactivityTimeout;

    panelTitle.textContent = state.user.secretariaName
      ? `${state.user.secretariaName} - ${state.systems.length} sistema(s)`
      : "Painel institucional";

    if (state.user.role === "admin") {
      adminButton.classList.remove("is-hidden");
      adminButton.addEventListener("click", () => {
        window.location.href = "/admin";
      });
    }

    renderSystems();
    showSlide(0);
    startSlideshow();
    registerInteractions();
    setupInitialFullscreen();
  } catch (error) {
    window.location.href = "/login";
  }
}

logoutButton.addEventListener("click", async () => {
  await fetchJson("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.href = "/login";
});

bootstrap();
