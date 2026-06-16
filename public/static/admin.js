const secretariaCount = document.getElementById("secretariaCount");
const systemCount = document.getElementById("systemCount");
const userCount = document.getElementById("userCount");
const hotspotPhoneCount = document.getElementById("hotspotPhoneCount");
const hotspotDayCount = document.getElementById("hotspotDayCount");
const adminWelcome = document.getElementById("adminWelcome");
const adminMessage = document.getElementById("adminMessage");
const secretariasTable = document.getElementById("secretariasTable");
const systemsTable = document.getElementById("systemsTable");
const usersTable = document.getElementById("usersTable");
const hotspotPhonesTable = document.getElementById("hotspotPhonesTable");
const hotspotDateFilter = document.getElementById("hotspotDateFilter");
const exportHotspotXlsx = document.getElementById("exportHotspotXlsx");
const permissionSecretariaSelect = document.getElementById("permissionSecretariaSelect");
const permissionsGrid = document.getElementById("permissionsGrid");
const newUserSecretaria = document.getElementById("newUserSecretaria");
const savePermissionsButton = document.getElementById("savePermissionsButton");
const createSecretariaForm = document.getElementById("createSecretariaForm");
const createSystemForm = document.getElementById("createSystemForm");
const createUserForm = document.getElementById("createUserForm");
const logoutButton = document.getElementById("logoutButton");
const backToPanel = document.getElementById("backToPanel");

const state = {
  user: null,
  secretarias: [],
  systems: [],
  users: [],
  assignments: [],
  hotspotTelefones: [],
  hotspotTelefoneCount: 0,
  hotspotDiaCount: 0,
  selectedSecretariaId: null,
};

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

function findAssignments(secretariaId) {
  return state.assignments.filter((item) => item.secretariaId === secretariaId);
}

function setMessage(text, isError = false) {
  adminMessage.textContent = text;
  adminMessage.style.color = isError ? "#a5264c" : "#0f5d8f";
}

function getTodayInputValue() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function updateHotspotExportLink() {
  if (!exportHotspotXlsx) return;

  const queryString = getHotspotDateQueryString();
  exportHotspotXlsx.href = `/api/admin/hotspot/telefones.xlsx${queryString ? `?${queryString}` : ""}`;
}

function getHotspotDateQueryString(paramName = "date") {
  const params = new URLSearchParams();
  if (hotspotDateFilter && hotspotDateFilter.value) {
    params.set(paramName, hotspotDateFilter.value);
  }

  return params.toString();
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(`${value}Z`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function renderStats() {
  secretariaCount.textContent = String(state.secretarias.length);
  systemCount.textContent = String(state.systems.length);
  userCount.textContent = String(state.users.length);
  hotspotPhoneCount.textContent = String(state.hotspotTelefoneCount ?? state.hotspotTelefones.length);
  hotspotDayCount.textContent = String(state.hotspotDiaCount ?? state.hotspotTelefones.length);
  adminWelcome.textContent = state.user ? `${state.user.name} (${state.user.email})` : "";
}

function renderSecretariaOptions() {
  const options = state.secretarias
    .map((secretaria) => `<option value="${secretaria.id}">${escapeHtml(secretaria.name)}</option>`)
    .join("");

  permissionSecretariaSelect.innerHTML = options;
  newUserSecretaria.innerHTML = `<option value="">Sem setor</option>${options}`;

  if (!state.selectedSecretariaId && state.secretarias[0]) {
    state.selectedSecretariaId = state.secretarias[0].id;
  }

  if (state.selectedSecretariaId) {
    permissionSecretariaSelect.value = String(state.selectedSecretariaId);
  }
}

function renderSecretariasTable() {
  secretariasTable.innerHTML = state.secretarias
    .map(
      (secretaria) => `
        <tr data-id="${secretaria.id}">
          <td>
            <input data-field="name" type="text" value="${escapeHtml(secretaria.name)}" />
            <input data-field="slug" type="hidden" value="${escapeHtml(secretaria.slug)}" />
          </td>
          <td><input data-field="isActive" type="checkbox" ${secretaria.isActive ? "checked" : ""} /></td>
          <td class="row-save"><button type="button" data-action="save-secretaria">Salvar</button></td>
        </tr>
      `
    )
    .join("");
}

function renderSystemsTable() {
  systemsTable.innerHTML = state.systems
    .map(
      (system) => `
        <tr data-id="${system.id}">
          <td>
            <input data-field="name" type="text" value="${escapeHtml(system.name)}" />
            <input data-field="slug" type="hidden" value="${escapeHtml(system.slug)}" />
          </td>
          <td><input data-field="url" type="text" value="${escapeHtml(system.url)}" placeholder="Link opcional" /></td>
          <td>
            ${
              system.mediaUrl
                ? String(system.mediaType || "").startsWith("video/")
                  ? `<video class="admin-media-preview" src="${escapeHtml(system.mediaUrl)}" muted loop playsinline></video>`
                  : `<img class="admin-media-preview" src="${escapeHtml(system.mediaUrl)}" alt="${escapeHtml(system.name)}" />`
                : `<span class="empty-media">Sem midia</span>`
            }
            <input data-field="media" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" />
            ${
              system.mediaUrl
                ? `
                  <label class="media-remove-label">
                    <input data-field="removeMedia" type="checkbox" />
                    Remover
                  </label>
                `
                : ""
            }
          </td>
          <td><input data-field="description" type="text" value="${escapeHtml(system.description || "")}" /></td>
          <td>
            <input
              data-field="displaySeconds"
              type="number"
              min="1"
              max="3600"
              value="${escapeHtml(system.displaySeconds || 10)}"
            />
          </td>
          <td><input data-field="position" type="number" min="1" value="${system.position}" /></td>
          <td><input data-field="isActive" type="checkbox" ${system.isActive ? "checked" : ""} /></td>
          <td class="row-actions">
            <button type="button" data-action="save-system">Salvar</button>
            <button type="button" class="danger-button" data-action="delete-system">Excluir</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderUsersTable() {
  const secretariaOptions = [`<option value="">Sem setor</option>`]
    .concat(state.secretarias.map((secretaria) => `<option value="${secretaria.id}">${escapeHtml(secretaria.name)}</option>`))
    .join("");

  usersTable.innerHTML = state.users
    .map(
      (user) => `
        <tr data-id="${user.id}">
          <td><input data-field="name" type="text" value="${escapeHtml(user.name)}" /></td>
          <td><input data-field="email" type="email" value="${escapeHtml(user.email)}" /></td>
          <td>
            <select data-field="role">
              <option value="secretaria" ${user.role === "secretaria" ? "selected" : ""}>Setor</option>
              <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
            </select>
          </td>
          <td>
            <select data-field="secretariaId">
              ${secretariaOptions}
            </select>
          </td>
          <td><input data-field="password" type="password" placeholder="Opcional" /></td>
          <td><input data-field="isActive" type="checkbox" ${user.isActive ? "checked" : ""} /></td>
          <td class="row-save"><button type="button" data-action="save-user">Salvar</button></td>
        </tr>
      `
    )
    .join("");

  state.users.forEach((user) => {
    const row = usersTable.querySelector(`tr[data-id="${user.id}"]`);
    if (!row) return;
    const select = row.querySelector('[data-field="secretariaId"]');
    if (select) {
      select.value = user.secretariaId ? String(user.secretariaId) : "";
    }
  });
}

function renderPermissionsGrid() {
  const assignments = findAssignments(Number(state.selectedSecretariaId));
  const assignmentMap = new Map(assignments.map((item) => [item.systemId, item.displayOrder]));

  permissionsGrid.innerHTML = state.systems
    .map(
      (system) => `
        <label class="permission-item" data-system-id="${system.id}">
          <input type="checkbox" data-field="enabled" ${assignmentMap.has(system.id) ? "checked" : ""} />
          <div class="permission-copy">
            <h4>${escapeHtml(system.name)}</h4>
            <p>${escapeHtml(system.description || "Sem descricao informada.")}</p>
          </div>
          <input
            type="number"
            min="1"
            data-field="displayOrder"
            value="${assignmentMap.get(system.id) || system.position}"
          />
        </label>
      `
    )
    .join("");
}

function renderHotspotPhonesTable() {
  if (!state.hotspotTelefones.length) {
    hotspotPhonesTable.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">Nenhum telefone capturado ainda.</td>
      </tr>
    `;
    return;
  }

  hotspotPhonesTable.innerHTML = state.hotspotTelefones
    .slice(0, 100)
    .map(
      (item) => `
        <tr>
          <td><strong>${escapeHtml(item.telefone)}</strong></td>
          <td>${escapeHtml(item.origem || "-")}</td>
          <td>${escapeHtml(item.mac || "-")}</td>
          <td>${escapeHtml(item.ip || "-")}</td>
          <td>${escapeHtml(item.totalAcessos || 1)}</td>
          <td>${escapeHtml(formatDateTime(item.lastSeenAt))}</td>
        </tr>
      `
    )
    .join("");
}

function renderAll() {
  renderStats();
  renderSecretariaOptions();
  renderSecretariasTable();
  renderSystemsTable();
  renderUsersTable();
  renderPermissionsGrid();
  renderHotspotPhonesTable();
}

async function bootstrap() {
  try {
    const queryString = getHotspotDateQueryString("hotspotDate");
    const payload = await fetchJson(`/api/admin/bootstrap${queryString ? `?${queryString}` : ""}`);
    state.user = payload.user;
    state.secretarias = payload.secretarias;
    state.systems = payload.systems;
    state.users = payload.users;
    state.assignments = payload.assignments;
    state.hotspotTelefones = payload.hotspotTelefones || [];
    state.hotspotTelefoneCount = payload.hotspotTelefoneCount ?? state.hotspotTelefones.length;
    state.hotspotDiaCount = payload.hotspotDiaCount ?? state.hotspotTelefones.length;
    renderAll();
  } catch (error) {
    window.location.href = "/login";
  }
}

async function refreshHotspotTelefones() {
  try {
    const queryString = getHotspotDateQueryString();
    const payload = await fetchJson(`/api/admin/hotspot/telefones${queryString ? `?${queryString}` : ""}`);
    state.hotspotTelefones = payload.items || [];
    state.hotspotTelefoneCount = payload.overallTotal ?? state.hotspotTelefoneCount;
    state.hotspotDiaCount = payload.total ?? state.hotspotTelefones.length;
    renderStats();
    renderHotspotPhonesTable();
  } catch (error) {
    setMessage(error.message, true);
  }
}

createSecretariaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createSecretariaForm);

  try {
    await fetchJson("/api/admin/secretarias", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        slug: formData.get("slug"),
      }),
    });

    createSecretariaForm.reset();
    setMessage("Setor criado com sucesso.");
    await bootstrap();
  } catch (error) {
    setMessage(error.message, true);
  }
});

createSystemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createSystemForm);

  try {
    const mediaData = await readMediaFile(formData.get("media"));
    const name = String(formData.get("name") || "").trim();
    const url = String(formData.get("url") || "").trim();

    if (!name || (!url && !mediaData)) {
      throw new Error("Preencha nome e link ou selecione uma midia.");
    }

    if (!isValidOptionalUrl(url)) {
      throw new Error("Use um link iniciado com http ou https.");
    }

    await fetchJson("/api/admin/systems", {
      method: "POST",
      body: JSON.stringify({
        name,
        slug: formData.get("slug"),
        url,
        description: formData.get("description"),
        mediaData,
        displaySeconds: Number(formData.get("displaySeconds") || 10),
        position: Number(formData.get("position") || 1),
      }),
    });

    createSystemForm.reset();
    setMessage("Sistema criado com sucesso.");
    await bootstrap();
  } catch (error) {
    setMessage(error.message, true);
  }
});

createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createUserForm);

  try {
    await fetchJson("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        role: formData.get("role"),
        secretariaId: formData.get("secretariaId") || null,
      }),
    });

    createUserForm.reset();
    setMessage("Usuario criado com sucesso.");
    await bootstrap();
  } catch (error) {
    setMessage(error.message, true);
  }
});

secretariasTable.addEventListener("click", async (event) => {
  const button = event.target.closest('button[data-action="save-secretaria"]');
  if (!button) return;

  const row = button.closest("tr");
  const id = Number(row.dataset.id);

  try {
    await fetchJson(`/api/admin/secretarias/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: row.querySelector('[data-field="name"]').value,
        slug: row.querySelector('[data-field="slug"]').value,
        isActive: row.querySelector('[data-field="isActive"]').checked,
      }),
    });

    setMessage("Setor atualizado com sucesso.");
    await bootstrap();
  } catch (error) {
    setMessage(error.message, true);
  }
});

systemsTable.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const row = button.closest("tr");
  const id = Number(row.dataset.id);
  const action = button.dataset.action;
  const name = row.querySelector('[data-field="name"]').value || "este sistema";

  if (action === "delete-system") {
    const shouldDelete = window.confirm(
      `Excluir "${name}"? O sistema tambem sera removido dos acessos dos setores.`
    );

    if (!shouldDelete) return;

    try {
      await fetchJson(`/api/admin/systems/${id}`, {
        method: "DELETE",
      });

      setMessage("Sistema excluido com sucesso.");
      await bootstrap();
    } catch (error) {
      setMessage(error.message, true);
    }

    return;
  }

  if (action !== "save-system") return;

  try {
    const mediaData = await readMediaFile(row.querySelector('[data-field="media"]').files[0]);
    const name = row.querySelector('[data-field="name"]').value.trim();
    const url = row.querySelector('[data-field="url"]').value.trim();

    if (!isValidOptionalUrl(url)) {
      throw new Error("Use um link iniciado com http ou https.");
    }

    await fetchJson(`/api/admin/systems/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        slug: row.querySelector('[data-field="slug"]').value,
        url,
        description: row.querySelector('[data-field="description"]').value,
        mediaData,
        removeMedia: Boolean(row.querySelector('[data-field="removeMedia"]')?.checked),
        displaySeconds: Number(row.querySelector('[data-field="displaySeconds"]').value || 10),
        position: Number(row.querySelector('[data-field="position"]').value || 1),
        isActive: row.querySelector('[data-field="isActive"]').checked,
      }),
    });

    setMessage("Sistema atualizado com sucesso.");
    await bootstrap();
  } catch (error) {
    setMessage(error.message, true);
  }
});

usersTable.addEventListener("click", async (event) => {
  const button = event.target.closest('button[data-action="save-user"]');
  if (!button) return;

  const row = button.closest("tr");
  const id = Number(row.dataset.id);

  try {
    await fetchJson(`/api/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: row.querySelector('[data-field="name"]').value,
        email: row.querySelector('[data-field="email"]').value,
        role: row.querySelector('[data-field="role"]').value,
        secretariaId: row.querySelector('[data-field="secretariaId"]').value || null,
        password: row.querySelector('[data-field="password"]').value,
        isActive: row.querySelector('[data-field="isActive"]').checked,
      }),
    });

    setMessage("Usuario atualizado com sucesso.");
    await bootstrap();
  } catch (error) {
    setMessage(error.message, true);
  }
});

permissionSecretariaSelect.addEventListener("change", () => {
  state.selectedSecretariaId = Number(permissionSecretariaSelect.value);
  renderPermissionsGrid();
});

savePermissionsButton.addEventListener("click", async () => {
  const items = Array.from(permissionsGrid.querySelectorAll(".permission-item"))
    .map((item) => ({
      systemId: Number(item.dataset.systemId),
      enabled: item.querySelector('[data-field="enabled"]').checked,
      displayOrder: Number(item.querySelector('[data-field="displayOrder"]').value || 1),
    }))
    .filter((item) => item.enabled)
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((item) => ({
      systemId: item.systemId,
      displayOrder: item.displayOrder,
    }));

  try {
    await fetchJson(`/api/admin/secretarias/${state.selectedSecretariaId}/systems`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });

    setMessage("Permissoes atualizadas com sucesso.");
    await bootstrap();
  } catch (error) {
    setMessage(error.message, true);
  }
});

backToPanel.addEventListener("click", () => {
  window.location.href = "/painel";
});

logoutButton.addEventListener("click", async () => {
  await fetchJson("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.href = "/login";
});

if (hotspotDateFilter) {
  hotspotDateFilter.value = getTodayInputValue();
  hotspotDateFilter.addEventListener("input", () => {
    updateHotspotExportLink();
    refreshHotspotTelefones();
  });
  updateHotspotExportLink();
  window.setInterval(refreshHotspotTelefones, 30000);
}

bootstrap();
