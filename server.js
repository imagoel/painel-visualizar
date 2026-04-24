const path = require("path");
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const SQLiteStoreFactory = require("better-sqlite3-session-store");
const { createDatabase, slugify, mapUser } = require("./src/database");

const app = express();
const port = Number(process.env.PORT || 3000);
const dbFile = path.join(__dirname, "data", "painel.db");
const storeFactory = SQLiteStoreFactory(session);
const database = createDatabase(dbFile);

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
    position: Number(body.position || 1),
    isActive: body.isActive !== false && body.isActive !== "false",
  };
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

app.get("/api/admin/bootstrap", requireAdmin, (req, res) => {
  res.json({
    user: req.currentUser,
    secretarias: database.listSecretarias(),
    systems: database.listSystems(),
    users: database.listUsers(),
    assignments: database.listAssignments(),
  });
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
    const payload = normalizeSystemPayload(req.body);
    if (!payload.name || !payload.slug) {
      return res.status(400).json({ message: "Nome do sistema e obrigatorio." });
    }

    const system = database.createSystem(payload);
    return res.status(201).json({ system });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel criar o sistema." });
  }
});

app.put("/api/admin/systems/:id", requireAdmin, (req, res) => {
  try {
    const payload = normalizeSystemPayload({
      ...req.body,
      id: req.params.id,
    });

    if (!payload.name || !payload.slug) {
      return res.status(400).json({ message: "Nome do sistema e obrigatorio." });
    }

    const system = database.updateSystem(payload);
    return res.json({ system });
  } catch (error) {
    return res.status(400).json({ message: "Nao foi possivel atualizar o sistema." });
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

app.use("/api", (req, res) => {
  res.status(404).json({ message: "Rota nao encontrada." });
});

app.listen(port, () => {
  console.log(`Painel disponivel em http://localhost:${port}`);
});
