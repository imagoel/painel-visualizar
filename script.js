// ─── Configuração ─────────────────────────────────────────────────────────────
const SLIDE_DURATION = 30_000; // ms por slide (30 segundos)
const INACTIVITY_TIMEOUT = 30_000; // ms de inatividade para retomar (30 segundos)

const systems = [
  {
    id: "c2",
    name: "C2",
    url: "http://10.75.2.15:8020/",
  },
  {
    id: "sistema-2",
    name: "Sistema 2",
    url: "http://sim.amargosa.ba.gov.br/monitoramento/arrecadacao",
  },
  {
    id: "sistema-3",
    name: "Sistema 3",
    url: "",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isValidUrl = (v) =>
  typeof v === "string" && /^https?:\/\/.+/i.test(v.trim());

// ─── Elementos do DOM ─────────────────────────────────────────────────────────
const stage = document.getElementById("stage");
const dotsEl = document.getElementById("dots");
const progressEl = document.getElementById("progress");

// ─── Renderização dos tiles ───────────────────────────────────────────────────
const tiles = systems.map((sys) => {
  const tile = document.createElement("div");
  tile.className = "tv-tile";

  if (isValidUrl(sys.url)) {
    const iframe = document.createElement("iframe");
    iframe.src = sys.url;
    iframe.title = sys.name;
    iframe.loading = "lazy";
    tile.appendChild(iframe);
  } else {
    const ph = document.createElement("div");
    ph.className = "tv-placeholder";
    ph.innerHTML = `
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
      <span>${sys.name}</span>
      <small>Link ainda não configurado</small>`;
    tile.appendChild(ph);
  }

  stage.appendChild(tile);
  return tile;
});

// ─── Pontinhos indicadores ────────────────────────────────────────────────────
const dots = systems.map((_, i) => {
  const dot = document.createElement("div");
  dot.className = "tv-dot";
  dotsEl.appendChild(dot);
  return dot;
});

// ─── Estado ───────────────────────────────────────────────────────────────────
let current = 0;
let slideshowTimer = null;
let inactivityTimer = null;
let progressStart = null;
let progressAnimFrame = null;
let isPaused = false;

// ─── Mostrar slide ────────────────────────────────────────────────────────────
const showSlide = (index) => {
  current = ((index % tiles.length) + tiles.length) % tiles.length;

  tiles.forEach((t, i) => t.classList.toggle("is-active", i === current));
  dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
};

// ─── Barra de progresso ───────────────────────────────────────────────────────
const startProgress = () => {
  cancelAnimationFrame(progressAnimFrame);
  progressStart = performance.now();

  const tick = (now) => {
    const elapsed = now - progressStart;
    const pct = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
    progressEl.style.width = pct + "%";
    // Transition desativada para atualização frame-a-frame fluida
    progressEl.style.transition = "none";
    if (pct < 100) {
      progressAnimFrame = requestAnimationFrame(tick);
    }
  };

  progressAnimFrame = requestAnimationFrame(tick);
};

const resetProgress = () => {
  cancelAnimationFrame(progressAnimFrame);
  progressEl.style.width = "0%";
};

// ─── Slideshow automático ─────────────────────────────────────────────────────
const startSlideshow = () => {
  isPaused = false;
  clearInterval(slideshowTimer);
  showSlide(current);
  startProgress();

  slideshowTimer = setInterval(() => {
    current = (current + 1) % tiles.length;
    showSlide(current);
    startProgress();
  }, SLIDE_DURATION);
};

const pauseSlideshow = () => {
  if (isPaused) return;
  isPaused = true;
  clearInterval(slideshowTimer);
  resetProgress();
};

// ─── Timer de inatividade ─────────────────────────────────────────────────────
const resetInactivity = () => {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    // 30s sem interação → retoma slideshow do slide atual
    startSlideshow();
  }, INACTIVITY_TIMEOUT);
};

// ─── Interação do usuário ─────────────────────────────────────────────────────
const onUserInteraction = () => {
  pauseSlideshow();
  resetInactivity();
};

document.addEventListener("pointerdown", onUserInteraction, { passive: true });
document.addEventListener("keydown", onUserInteraction);

// ─── Tela cheia automática ────────────────────────────────────────────────────
const requestFs = () => {
  const el = document.documentElement;
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;
  if (fn) fn.call(el).catch(() => {});
};

if (!document.fullscreenElement) {
  requestFs();
  const once = () => {
    requestFs();
    document.removeEventListener("pointerdown", once);
  };
  document.addEventListener("pointerdown", once, { passive: true });
}

// ─── Inicializar ──────────────────────────────────────────────────────────────
startSlideshow();
