const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const SQLiteStoreFactory = require("better-sqlite3-session-store");
const ExcelJS = require("exceljs");
const { createDatabase, slugify, mapUser } = require(path.join(__dirname, "src", "database.js"));

const app = express();
const port = Number(process.env.PORT || 3000);
const dbFile = path.join(__dirname, "data", "painel.db");
const uploadDir = path.join(__dirname, "data", "uploads");
const maxUploadBytes = 20 * 1024 * 1024;
const requestBodyLimit = "50mb";
const storeFactory = SQLiteStoreFactory(session);
const database = createDatabase(dbFile);

fs.mkdirSync(uploadDir, { recursive: true });

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: requestBodyLimit }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "prefeitura-amargosa-change-me",
    resave: false,
    saveUninitialized: false,
    store: new storeFactory({
      client: database.db,
      expired: {
        clear: true,
        intervalMs: 15 * 60 * 1000,
      },
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 12 * 60 * 60 * 1000,
    },
  })
);

app.use("/assets", express.static(path.join(__dirname, "assets"), {
  maxAge: "7d",
  immutable: true,
}));

app.use("/uploads", express.static(uploadDir, {
  maxAge: "7d",
  immutable: true,
}));

app.use("/static", express.static(path.join(__dirname, "public", "static"), {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".js") || filePath.endsWith(".css")) {
      res.setHeader("Cache-Control", "no-store");
    }
  },
}));

function sendPage(res, name) {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "pages", name));
}

function requireAuthPage(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
}

function requireAdminPage(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const user = database.getUserById(req.session.user.id);
  if (!user || user.role !== "admin") {
    return res.redirect("/painel");
  }

  req.session.user = user;
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Sessao expirada." });
  }

  const user = database.getUserById(req.session.user.id);
  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Usuario indisponivel." });
  }

  req.currentUser = user;
  req.session.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.currentUser.role !== "admin") {
      return res.status(403).json({ message: "Acesso restrito ao administrador." });
    }

    next();
  });
}

function normalizeSecretariaPayload(body) {
  return {
    id: Number(body.id),
    name: String(body.name || "").trim(),
    slug: slugify(body.slug || body.name),
    isActive: body.isActive !== false && body.isActive !== "false",
  };
}

function normalizeSystemPayload(body) {
  return {
    id: Number(body.id),
    name: String(body.name || "").trim(),
    slug: slugify(body.slug || body.name),
    description: String(body.description || "").trim(),
    url: String(body.url || "").trim(),
    imagePath: String(body.imagePath || "").trim(),
    mediaType: String(body.mediaType || "").trim(),
    position: Number(body.position || 1),
    isActive: body.isActive !== false && body.isActive !== "false",
  };
}

function saveMediaDataUrl(value) {
  const dataUrl = String(value || "").trim();
  if (!dataUrl) return { mediaPath: "", mediaType: "" };

  const match = dataUrl.match(/^data:((?:image\/(?:png|jpeg|webp|gif))|(?:video\/(?:mp4|webm)));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Midia invalida.");
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > maxUploadBytes) {
    throw new Error("Use uma midia de ate 20 MB.");
  }

  const extensionByType = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };
  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}.${
    extensionByType[mimeType]
  }`;

  fs.writeFileSync(path.join(uploadDir, filename), buffer);
  return { mediaPath: filename, mediaType: mimeType };
}

function validateOptionalUrl(url) {
  if (!url) return true;

  try {
    const parsedUrl = new URL(url);
    return ["http:", "https:"].includes(parsedUrl.protocol);
  } catch (error) {
    return false;
  }
}

function normalizeUserPayload(body) {
  return {
    id: Number(body.id),
    name: String(body.name || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    password: String(body.password || "").trim(),
    role: body.role === "admin" ? "admin" : "secretaria",
    secretariaId: body.secretariaId ? Number(body.secretariaId) : null,
    isActive: body.isActive !== false && body.isActive !== "false",
  };
}

function normalizeTelefone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeHotspotTelefonePayload(req) {
  const body = {
    ...(req.query || {}),
    ...(req.body || {}),
  };
  const telefone = normalizeTelefone(body.telefone);
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();

  return {
    telefone,
    mac: String(body.mac || "").trim().slice(0, 32),
    ip: String(body.ip || forwardedFor || req.socket.remoteAddress || "").trim().slice(0, 64),
    origem: String(body.origem || "hotspot-amargosa").trim().slice(0, 80),
    userAgent: String(req.headers["user-agent"] || "").trim().slice(0, 300),
  };
}

function allowHotspotCaptureCors(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatSqlUtcDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function getHotspotDateFilter(value) {
  const date = String(value || "").trim();
  if (!date) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const [year, month, day] = date.split("-");
  const start = new Date(`${date}T00:00:00-03:00`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    date,
    label: `${day}/${month}/${year}`,
    startUtc: formatSqlUtcDateTime(start),
    endUtc: formatSqlUtcDateTime(end),
  };
}

function listHotspotExportItems(date) {
  const filter = getHotspotDateFilter(date);
  const items = filter
    ? database.listHotspotTelefonesByLastSeenRange(filter.startUtc, filter.endUtc, 1000000)
    : database.listHotspotTelefones(1000000);

  return { filter, items };
}

function saveHotspotTelefoneFromRequest(req, res) {
  const payload = normalizeHotspotTelefonePayload(req);

  if (payload.telefone.length !== 11 || /^(\d)\1{10}$/.test(payload.telefone)) {
    return null;
  }

  return database.saveHotspotTelefone(payload);
}

function formatCsvDateTime(value) {
  if (!value) return "";

  const date = new Date(`${value}Z`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function buildHotspotWorkbook(items, filter) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Painel Visualizar";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Telefones hotspot", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  worksheet.columns = [
    { header: "Telefone", key: "telefone", width: 18 },
    { header: "MAC", key: "mac", width: 22 },
    { header: "Ultimo registro", key: "lastSeenAt", width: 22 },
  ];

  worksheet.spliceRows(1, 0, ["Telefones capturados no hotspot"]);
  worksheet.spliceRows(2, 0, [
    filter ? `Filtro: primeira captura em ${filter.label}` : "Filtro: todos os registros",
  ]);
  worksheet.mergeCells("A1:C1");
  worksheet.mergeCells("A2:C2");

  worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF155A7E" } };
  worksheet.getCell("A1").alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 26;

  worksheet.getCell("A2").font = { italic: true, color: { argb: "FF526071" } };
  worksheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF5FA" } };

  const headerRow = worksheet.getRow(3);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA5264C" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;

  items.forEach((item) => {
    worksheet.addRow({
      telefone: item.telefone,
      mac: item.mac,
      lastSeenAt: formatCsvDateTime(item.lastSeenAt),
    });
  });

  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: 3 },
  };

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cell.alignment = {
        vertical: "middle",
        wrapText: rowNumber > 3,
      };
    });
  });

  worksheet.getColumn("telefone").numFmt = "@";
  worksheet.getColumn("mac").numFmt = "@";

  return workbook.xlsx.writeBuffer();
}

app.get("/", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  return res.redirect("/painel");
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/painel");
  }

  return sendPage(res, "login.html");
});

app.get("/painel", requireAuthPage, (req, res) => sendPage(res, "panel.html"));
app.get("/admin", requireAdminPage, (req, res) => sendPage(res, "admin.html"));

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    user: req.currentUser,
  });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "").trim();

  if (!email || !password) {
    return res.status(400).json({ message: "Informe e-mail e senha." });
  }

  const user = database.getUserByEmail(email);
  if (!user || !user.is_active) {
    return res.status(401).json({ message: "Credenciais invalidas." });
  }

  const passwordMatches = bcrypt.compareSync(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ message: "Credenciais invalidas." });
  }

  req.session.user = mapUser(user);
  res.json({
    user: req.session.user,
  });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

app.options("/api/hotspot/telefones", allowHotspotCaptureCors);
app.post("/api/hotspot/telefones", allowHotspotCaptureCors, (req, res) => {
  const item = saveHotspotTelefoneFromRequest(req, res);
  if (!item) {
    return res.status(400).json({ message: "Telefone invalido." });
  }

  return res.status(201).json({ success: true, item });
});

app.get("/api/hotspot/telefones", allowHotspotCaptureCors, (req, res) => {
  const item = saveHotspotTelefoneFromRequest(req, res);
  if (!item) {
    return res.status(400).json({ message: "Telefone invalido." });
  }

  const pixel = Buffer.from("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "image/gif");
  return res.send(pixel);
});

app.get("/api/panel/config", requireAuth, (req, res) => {
  const systems = database.getSystemsForUser(req.currentUser);
  res.json({
    user: req.currentUser,
    systems,
    settings: {
      slideDuration: 30000,
      inactivityTimeout: 30000,
    },
  });
});

app.post("/api/panel/systems", requireAuth, (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const url = String(req.body.url || "").trim();
    const media = saveMediaDataUrl(req.body.mediaData || req.body.imageData);

    if (!name || (!url && !media.mediaPath)) {
      return res.status(400).json({ message: "Informe nome e link ou selecione uma midia." });
    }

    if (!validateOptionalUrl(url)) {
      return res.status(400).json({ message: "Use um link iniciado com http ou https." });
    }

    if (req.currentUser.role !== "admin" && !req.currentUser.secretariaId) {
      return res.status(400).json({ message: "Usuario sem secretaria vinculada." });
    }

    const baseSlug = slugify(req.body.slug || name) || "sistema";
    const payload = normalizeSystemPayload({
      ...req.body,
      name,
      url,
      slug: `${baseSlug}-${Date.now().toString(36)}`,
      description: req.body.description || (media.mediaPath && !url ? "Banner adicionado pela visualizacao" : "Sistema adicionado pela visualizacao"),
      imagePath: media.mediaPath,
      mediaType: media.mediaType,
      position: database.listSystems().length + 1,
      isActive: true,
    });

    const system = database.createSystemForSecretaria(payload, req.currentUser.secretariaId);
    const systems = database.getSystemsForUser(req.currentUser);
    return res.status(201).json({ system, systems });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel adicionar o sistema." });
  }
});

app.put("/api/panel/systems/selection", requireAuth, (req, res) => {
  try {
    if (!req.currentUser.secretariaId) {
      return res.json({ systems: database.getSystemsForUser(req.currentUser) });
    }

    const ids = Array.isArray(req.body.systemIds) ? req.body.systemIds : [];
    const normalizedIds = ids.map((id) => Number(id));
    const hasInvalidId = normalizedIds.some((id) => !Number.isInteger(id) || id <= 0);

    if (hasInvalidId) {
      return res.status(400).json({ message: "Lista de sistemas invalida." });
    }

    const selectedIds = Array.from(new Set(normalizedIds));
    const allowedSystems = database.getSystemsForUser(req.currentUser);
    const allowedMap = new Map(allowedSystems.map((system, index) => [system.id, { system, index }]));
    const hasBlockedSystem = selectedIds.some((id) => !allowedMap.has(id));

    if (hasBlockedSystem) {
      return res.status(404).json({ message: "Sistema nao encontrado para este usuario." });
    }

    const items = selectedIds
      .sort((left, right) => allowedMap.get(left).index - allowedMap.get(right).index)
      .map((systemId, index) => ({
        systemId,
        displayOrder: index + 1,
      }));

    database.replaceSecretariaSystems(req.currentUser.secretariaId, items);

    return res.json({ systems: database.getSystemsForUser(req.currentUser) });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel salvar a visualizacao." });
  }
});

app.put("/api/panel/systems/:id", requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existingSystem = database.getSystemById(id);
    const allowedSystems = database.getSystemsForUser(req.currentUser);
    const canEdit = allowedSystems.some((system) => system.id === id);

    if (!existingSystem || !canEdit) {
      return res.status(404).json({ message: "Sistema nao encontrado para este usuario." });
    }

    const name = String(req.body.name || "").trim();
    const url = String(req.body.url || "").trim();
    const media = saveMediaDataUrl(req.body.mediaData || req.body.imageData);
    const removeMedia = req.body.removeMedia === true || req.body.removeMedia === "true" || req.body.removeImage === true || req.body.removeImage === "true";
    const imagePath = media.mediaPath || (removeMedia ? "" : existingSystem.imagePath);
    const mediaType = media.mediaType || (removeMedia ? "" : existingSystem.mediaType || "");

    if (!name || (!url && !imagePath)) {
      return res.status(400).json({ message: "Informe nome e link ou selecione uma midia." });
    }

    if (!validateOptionalUrl(url)) {
      return res.status(400).json({ message: "Use um link iniciado com http ou https." });
    }

    const system = database.updateSystem({
      id,
      name,
      slug: existingSystem.slug,
      description: String(req.body.description || "").trim(),
      url,
      imagePath,
      mediaType,
      position: existingSystem.position,
      isActive: existingSystem.isActive,
    });
    const systems = database.getSystemsForUser(req.currentUser);

    return res.json({ system, systems });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel editar o sistema." });
  }
});

app.delete("/api/panel/systems/:id", requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existingSystem = database.getSystemById(id);
    const allowedSystems = database.getSystemsForUser(req.currentUser);
    const canRemove = allowedSystems.some((system) => system.id === id);

    if (!existingSystem || !canRemove) {
      return res.status(404).json({ message: "Sistema nao encontrado para este usuario." });
    }

    if (req.currentUser.secretariaId) {
      database.removeSystemFromSecretaria(req.currentUser.secretariaId, id);
    } else if (req.currentUser.role === "admin") {
      database.deactivateSystem(id);
    } else {
      return res.status(400).json({ message: "Usuario sem secretaria vinculada." });
    }

    const systems = database.getSystemsForUser(req.currentUser);
    return res.json({ success: true, systems });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel excluir o sistema." });
  }
});

app.get("/api/admin/bootstrap", requireAdmin, (req, res) => {
  const hotspot = listHotspotExportItems(req.query.hotspotDate || req.query.date);
  const hotspotTotal = database.countHotspotTelefones();

  res.json({
    user: req.currentUser,
    secretarias: database.listSecretarias(),
    systems: database.listSystems(),
    users: database.listUsers(),
    assignments: database.listAssignments(),
    hotspotTelefones: hotspot.items.slice(0, 1000),
    hotspotTelefoneCount: hotspotTotal,
    hotspotDiaCount: hotspot.filter ? hotspot.items.length : hotspotTotal,
  });
});

app.get("/api/admin/hotspot/telefones", requireAdmin, (req, res) => {
  const hotspot = listHotspotExportItems(req.query.date);
  const hotspotTotal = database.countHotspotTelefones();

  res.json({
    items: hotspot.items.slice(0, 2000),
    total: hotspot.filter ? hotspot.items.length : hotspotTotal,
    overallTotal: hotspotTotal,
  });
});

app.get("/api/admin/hotspot/telefones.csv", requireAdmin, (req, res) => {
  const { items } = listHotspotExportItems(req.query.date);
  const header = [
    "numero do telefone",
    "mac",
    "ultimo registro",
  ];
  const rows = items.map((item) => [
    item.telefone,
    item.mac,
    formatCsvDateTime(item.lastSeenAt),
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(";")).join("\r\n");

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=telefones-hotspot.csv");
  return res.send(`\uFEFF${csv}\r\n`);
});

app.get("/api/admin/hotspot/telefones.xlsx", requireAdmin, async (req, res) => {
  try {
    const { filter, items } = listHotspotExportItems(req.query.date);
    const buffer = await buildHotspotWorkbook(items, filter);
    const suffix = filter ? filter.date : "todos";

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=telefones-hotspot-${suffix}.xlsx`);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel exportar a planilha." });
  }
});

app.post("/api/admin/secretarias", requireAdmin, (req, res) => {
  try {
    const payload = normalizeSecretariaPayload(req.body);
    if (!payload.name || !payload.slug) {
      return res.status(400).json({ message: "Nome da secretaria e obrigatorio." });
    }

    const secretaria = database.createSecretaria(payload);
    return res.status(201).json({ secretaria });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel criar a secretaria." });
  }
});

app.put("/api/admin/secretarias/:id", requireAdmin, (req, res) => {
  try {
    const payload = normalizeSecretariaPayload({
      ...req.body,
      id: req.params.id,
    });

    if (!payload.name || !payload.slug) {
      return res.status(400).json({ message: "Nome da secretaria e obrigatorio." });
    }

    const secretaria = database.updateSecretaria(payload);
    return res.json({ secretaria });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel atualizar a secretaria." });
  }
});

app.post("/api/admin/systems", requireAdmin, (req, res) => {
  try {
    const media = saveMediaDataUrl(req.body.mediaData || req.body.imageData);
    const payload = normalizeSystemPayload({
      ...req.body,
      imagePath: media.mediaPath,
      mediaType: media.mediaType,
    });
    if (!payload.name || !payload.slug) {
      return res.status(400).json({ message: "Nome do sistema e obrigatorio." });
    }

    if (!payload.url && !payload.imagePath) {
      return res.status(400).json({ message: "Informe um link ou selecione uma midia." });
    }

    if (!validateOptionalUrl(payload.url)) {
      return res.status(400).json({ message: "Use um link iniciado com http ou https." });
    }

    const system = database.createSystem(payload);
    return res.status(201).json({ system });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel criar o sistema." });
  }
});

app.put("/api/admin/systems/:id", requireAdmin, (req, res) => {
  try {
    const existingSystem = database.getSystemById(Number(req.params.id));
    if (!existingSystem) {
      return res.status(404).json({ message: "Sistema nao encontrado." });
    }

    const media = saveMediaDataUrl(req.body.mediaData || req.body.imageData);
    const removeMedia = req.body.removeMedia === true || req.body.removeMedia === "true" || req.body.removeImage === true || req.body.removeImage === "true";
    const imagePath = media.mediaPath || (removeMedia ? "" : existingSystem.imagePath);
    const mediaType = media.mediaType || (removeMedia ? "" : existingSystem.mediaType || "");

    const payload = normalizeSystemPayload({
      ...req.body,
      id: req.params.id,
      imagePath,
      mediaType,
    });

    if (!payload.name || !payload.slug) {
      return res.status(400).json({ message: "Nome do sistema e obrigatorio." });
    }

    if (!payload.url && !payload.imagePath) {
      return res.status(400).json({ message: "Informe um link ou selecione uma midia." });
    }

    if (!validateOptionalUrl(payload.url)) {
      return res.status(400).json({ message: "Use um link iniciado com http ou https." });
    }

    const system = database.updateSystem(payload);
    return res.json({ system });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel atualizar o sistema." });
  }
});

app.delete("/api/admin/systems/:id", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Sistema invalido." });
    }

    const removed = database.deleteSystem(id);
    if (!removed) {
      return res.status(404).json({ message: "Sistema nao encontrado." });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel excluir o sistema." });
  }
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  try {
    const payload = normalizeUserPayload(req.body);
    if (!payload.name || !payload.email || !payload.password) {
      return res.status(400).json({ message: "Nome, e-mail e senha sao obrigatorios." });
    }

    const user = database.createUser(payload);
    return res.status(201).json({ user });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel criar o usuario." });
  }
});

app.put("/api/admin/users/:id", requireAdmin, (req, res) => {
  try {
    const payload = normalizeUserPayload({
      ...req.body,
      id: req.params.id,
    });

    if (!payload.name || !payload.email) {
      return res.status(400).json({ message: "Nome e e-mail sao obrigatorios." });
    }

    const user = database.updateUser(payload);
    return res.json({ user });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel atualizar o usuario." });
  }
});

app.put("/api/admin/secretarias/:id/systems", requireAdmin, (req, res) => {
  try {
    const secretariaId = Number(req.params.id);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const normalizedItems = items
      .map((item, index) => ({
        systemId: Number(item.systemId),
        displayOrder: Number(item.displayOrder || index + 1),
      }))
      .filter((item) => Number.isInteger(item.systemId) && item.systemId > 0)
      .sort((left, right) => left.displayOrder - right.displayOrder);

    database.replaceSecretariaSystems(secretariaId, normalizedItems);
    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel salvar os acessos da secretaria." });
  }
});

app.use((error, req, res, next) => {
  if (error && (error.type === "entity.too.large" || error.status === 413)) {
    return res.status(413).json({
      message: "Arquivo muito grande. Use uma midia de ate 20 MB. Se houver Nginx, ajuste client_max_body_size para 50M.",
    });
  }

  if (req.path.startsWith("/api")) {
    return res.status(500).json({ message: "Nao foi possivel concluir a requisicao." });
  }

  return next(error);
});

app.use("/api", (req, res) => {
  res.status(404).json({ message: "Rota nao encontrada." });
});

app.listen(port, () => {
  console.log(`Painel disponivel em http://localhost:${port}`);
});
