// ─── Configuração dos sistemas ────────────────────────────────────────────────
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
const isValidUrl = (value) =>
  typeof value === "string" && /^https?:\/\/.+/i.test(value.trim());

// ─── Estado ───────────────────────────────────────────────────────────────────
let focusedIndex = 0;   // coluna atualmente selecionada (0-2)
let isExpanded = false; // true quando uma coluna está em tela cheia

// ─── Renderização ─────────────────────────────────────────────────────────────
const grid = document.getElementById("grid");
const tiles = [];

const buildTile = (system) => {
  const tile = document.createElement("div");
  tile.className = "tv-tile";
  tile.setAttribute("tabindex", "-1");

  if (isValidUrl(system.url)) {
    const iframe = document.createElement("iframe");
    iframe.src = system.url;
    iframe.title = system.name;
    iframe.loading = "lazy";
    iframe.setAttribute("allowfullscreen", "");
    tile.appendChild(iframe);
  } else {
    const ph = document.createElement("div");
    ph.className = "tv-placeholder";
    ph.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
      <span>${system.name}</span>
      <small>Link ainda não configurado</small>`;
    tile.appendChild(ph);
  }

  return tile;
};

systems.forEach((sys) => {
  const tile = buildTile(sys);
  grid.appendChild(tile);
  tiles.push(tile);
});

// ─── Foco visual ──────────────────────────────────────────────────────────────
const setFocus = (index) => {
  tiles.forEach((t) => t.classList.remove("is-focused"));
  focusedIndex = ((index % tiles.length) + tiles.length) % tiles.length;
  tiles[focusedIndex].classList.add("is-focused");
};

// Inicializa sem foco visível (aparece só quando o usuário interage)
let navActive = false;

const activateNav = () => {
  if (!navActive) {
    navActive = true;
    setFocus(0);
  }
};

// ─── Expansão de coluna (OK / Enter) ─────────────────────────────────────────
const expandTile = (index) => {
  if (isExpanded) return;
  isExpanded = true;
  tiles[index].classList.add("is-fullscreen");
  tiles[index].classList.remove("is-focused");
};

const collapseTile = () => {
  if (!isExpanded) return;
  isExpanded = false;
  tiles.forEach((t) => t.classList.remove("is-fullscreen"));
  setFocus(focusedIndex);
};

// ─── Controle por teclado / controle remoto ───────────────────────────────────
// Teclas do controle remoto de TV mapeiam para teclas padrão:
// Seta Esquerda  → ArrowLeft
// Seta Direita   → ArrowRight
// OK / Select    → Enter
// Voltar / ESC   → Escape
document.addEventListener("keydown", (e) => {
  // Nunca intercepta combos com Ctrl/Alt/Meta
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  switch (e.key) {
    case "ArrowLeft":
      e.preventDefault();
      activateNav();
      if (!isExpanded) setFocus(focusedIndex - 1);
      break;

    case "ArrowRight":
      e.preventDefault();
      activateNav();
      if (!isExpanded) setFocus(focusedIndex + 1);
      break;

    case "Enter":
      e.preventDefault();
      activateNav();
      if (isExpanded) {
        collapseTile();
      } else {
        expandTile(focusedIndex);
      }
      break;

    case "Escape":
      e.preventDefault();
      collapseTile();
      break;

    default:
      break;
  }
});

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
