const secretariaCount = document.getElementById("secretariaCount");
const systemCount = document.getElementById("systemCount");
const userCount = document.getElementById("userCount");
const adminWelcome = document.getElementById("adminWelcome");
const adminMessage = document.getElementById("adminMessage");
const secretariasTable = document.getElementById("secretariasTable");
const systemsTable = document.getElementById("systemsTable");
const usersTable = document.getElementById("usersTable");
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

function findAssignments(secretariaId) {
  return state.assignments.filter((item) => item.secretariaId === secretariaId);
}

function setMessage(text, isError = false) {
  adminMessage.textContent = text;
  adminMessage.style.color = isError ? "#a5264c" : "#0f5d8f";
}

function renderStats() {
  secretariaCount.textContent = String(state.secretarias.length);
  systemCount.textContent = String(state.systems.length);
  userCount.textContent = String(state.users.length);
  adminWelcome.textContent = state.user ? `${state.user.name} (${state.user.email})` : "";
}

function renderSecretariaOptions() {
  const options = state.secretarias
    .map((secretaria) => `<option value="${secretaria.id}">${escapeHtml(secretaria.name)}</option>`)
    .join("");

  permissionSecretariaSelect.innerHTML = options;
  newUserSecretaria.innerHTML = `<option value="">Sem secretaria</option>${options}`;

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
          <td><input data-field="name" type="text" value="${escapeHtml(secretaria.name)}" /></td>
          <td>
            <input
              data-field="slug"
              type="text"
              placeholder="Identificador"
              value="${escapeHtml(secretaria.slug)}"
            />
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
            <input
              data-field="slug"
              type="text"
              placeholder="Identificador"
              value="${escapeHtml(system.slug)}"
            />
          </td>
          <td>
            <input data-field="url" type="url" value="${escapeHtml(system.url)}" />
            <input data-field="description" type="text" value="${escapeHtml(system.description || "")}" />
          </td>
          <td><input data-field="position" type="number" min="1" value="${system.position}" /></td>
          <td><input data-field="isActive" type="checkbox" ${system.isActive ? "checked" : ""} /></td>
          <td class="row-save"><button type="button" data-action="save-system">Salvar</button></td>
        </tr>
      `
    )
    .join("");
}

function renderUsersTable() {
  const secretariaOptions = [`<option value="">Sem secretaria</option>`]
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
              <option value="secretaria" ${user.role === "secretaria" ? "selected" : ""}>Secretaria</option>
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

function renderAll() {
  renderStats();
  renderSecretariaOptions();
  renderSecretariasTable();
  renderSystemsTable();
  renderUsersTable();
  renderPermissionsGrid();
}

async function bootstrap() {
  try {
    const payload = await fetchJson("/api/admin/bootstrap");
    state.user = payload.user;
    state.secretarias = payload.secretarias;
    state.systems = payload.systems;
    state.users = payload.users;
    state.assignments = payload.assignments;
    renderAll();
  } catch (error) {
    window.location.href = "/login";
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
    setMessage("Secretaria criada com sucesso.");
    await bootstrap();
  } catch (error) {
    setMessage(error.message, true);
  }
});

createSystemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createSystemForm);

  try {
    await fetchJson("/api/admin/systems", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        slug: formData.get("slug"),
        url: formData.get("url"),
        description: formData.get("description"),
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

    setMessage("Secretaria atualizada com sucesso.");
    await bootstrap();
  } catch (error) {
    setMessage(error.message, true);
  }
});

systemsTable.addEventListener("click", async (event) => {
  const button = event.target.closest('button[data-action="save-system"]');
  if (!button) return;

  const row = button.closest("tr");
  const id = Number(row.dataset.id);

  try {
    await fetchJson(`/api/admin/systems/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: row.querySelector('[data-field="name"]').value,
        slug: row.querySelector('[data-field="slug"]').value,
        url: row.querySelector('[data-field="url"]').value,
        description: row.querySelector('[data-field="description"]').value,
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

bootstrap();
