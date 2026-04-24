const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const DEFAULT_SECRETARIA = {
  name: "SEAFI",
  slug: "seafi",
};

const DEFAULT_SYSTEMS = [
  {
    name: "C2",
    slug: "c2",
    description: "Sistema principal",
    url: "http://10.75.2.15:8020/",
    position: 1,
  },
  {
    name: "Sistema 2",
    slug: "sistema-2",
    description: "Monitoramento da arrecadacao",
    url: "http://sim.amargosa.ba.gov.br/monitoramento/arrecadacao",
    position: 2,
  },
  {
    name: "Sistema 3",
    slug: "sistema-3",
    description: "Painel financeiro",
    url: "https://prodeboffice365-my.sharepoint.com/personal/seafi_suplan_amargosa_ba_gov_br/_layouts/15/doc2.aspx?sourcedoc=%7Bca42cb15-1cf0-4c32-b58c-5d9f788c2269%7D&action=embedview&ClientRender=1",
    position: 3,
  },
];

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function mapUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    secretariaId: row.secretaria_id,
    secretariaName: row.secretaria_name || null,
    isActive: Boolean(row.is_active),
  };
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS secretarias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS systems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'secretaria',
      secretaria_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (secretaria_id) REFERENCES secretarias (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS secretaria_systems (
      secretaria_id INTEGER NOT NULL,
      system_id INTEGER NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (secretaria_id, system_id),
      FOREIGN KEY (secretaria_id) REFERENCES secretarias (id) ON DELETE CASCADE,
      FOREIGN KEY (system_id) REFERENCES systems (id) ON DELETE CASCADE
    );
  `);
}

function seedIfNeeded(db) {
  const secretariaCount = db.prepare("SELECT COUNT(*) AS total FROM secretarias").get().total;
  const systemCount = db.prepare("SELECT COUNT(*) AS total FROM systems").get().total;
  const userCount = db.prepare("SELECT COUNT(*) AS total FROM users").get().total;

  if (secretariaCount === 0) {
    db.prepare(
      `
        INSERT INTO secretarias (name, slug, is_active)
        VALUES (@name, @slug, 1)
      `
    ).run(DEFAULT_SECRETARIA);
  }

  if (systemCount === 0) {
    const insertSystem = db.prepare(
      `
        INSERT INTO systems (name, slug, description, url, position, is_active)
        VALUES (@name, @slug, @description, @url, @position, 1)
      `
    );

    const insertMany = db.transaction((items) => {
      items.forEach((item) => insertSystem.run(item));
    });

    insertMany(DEFAULT_SYSTEMS);
  }

  const seafi = db.prepare("SELECT id FROM secretarias WHERE slug = ?").get(DEFAULT_SECRETARIA.slug);

  const ensureAssignments = db.transaction(() => {
    const assignments = db
      .prepare("SELECT COUNT(*) AS total FROM secretaria_systems WHERE secretaria_id = ?")
      .get(seafi.id).total;

    if (assignments > 0) return;

    const systems = db.prepare("SELECT id, position FROM systems ORDER BY position ASC, id ASC").all();
    const insertAssignment = db.prepare(
      `
        INSERT INTO secretaria_systems (secretaria_id, system_id, display_order)
        VALUES (?, ?, ?)
      `
    );

    systems.forEach((system, index) => {
      insertAssignment.run(seafi.id, system.id, index + 1);
    });
  });

  ensureAssignments();

  if (userCount === 0) {
    const insertUser = db.prepare(
      `
        INSERT INTO users (name, email, password_hash, role, secretaria_id, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `
    );

    insertUser.run(
      "Administrador",
      "admin@amargosa.ba.gov.br",
      bcrypt.hashSync("admin123", 10),
      "admin",
      seafi.id
    );

    insertUser.run(
      "SEAFI",
      "seafi@amargosa.ba.gov.br",
      bcrypt.hashSync("seafi123", 10),
      "secretaria",
      seafi.id
    );
  }
}

function createDatabase(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  ensureSchema(db);
  seedIfNeeded(db);

  const statements = {
    userByEmail: db.prepare(`
      SELECT
        users.*,
        secretarias.name AS secretaria_name
      FROM users
      LEFT JOIN secretarias ON secretarias.id = users.secretaria_id
      WHERE lower(users.email) = lower(?)
    `),
    userById: db.prepare(`
      SELECT
        users.*,
        secretarias.name AS secretaria_name
      FROM users
      LEFT JOIN secretarias ON secretarias.id = users.secretaria_id
      WHERE users.id = ?
    `),
    allUsers: db.prepare(`
      SELECT
        users.*,
        secretarias.name AS secretaria_name
      FROM users
      LEFT JOIN secretarias ON secretarias.id = users.secretaria_id
      ORDER BY users.name ASC
    `),
    allSecretarias: db.prepare(`
      SELECT *
      FROM secretarias
      ORDER BY name ASC
    `),
    allSystems: db.prepare(`
      SELECT *
      FROM systems
      ORDER BY position ASC, name ASC
    `),
    systemsForSecretaria: db.prepare(`
      SELECT
        systems.*,
        secretaria_systems.display_order
      FROM secretaria_systems
      JOIN systems ON systems.id = secretaria_systems.system_id
      WHERE secretaria_systems.secretaria_id = ?
        AND systems.is_active = 1
      ORDER BY secretaria_systems.display_order ASC, systems.position ASC, systems.id ASC
    `),
    assignmentsBySecretaria: db.prepare(`
      SELECT secretaria_id, system_id, display_order
      FROM secretaria_systems
      ORDER BY secretaria_id ASC, display_order ASC
    `),
    insertSecretaria: db.prepare(`
      INSERT INTO secretarias (name, slug, is_active, updated_at)
      VALUES (@name, @slug, @is_active, CURRENT_TIMESTAMP)
    `),
    updateSecretaria: db.prepare(`
      UPDATE secretarias
      SET
        name = @name,
        slug = @slug,
        is_active = @is_active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `),
    insertSystem: db.prepare(`
      INSERT INTO systems (name, slug, description, url, position, is_active, updated_at)
      VALUES (@name, @slug, @description, @url, @position, @is_active, CURRENT_TIMESTAMP)
    `),
    updateSystem: db.prepare(`
      UPDATE systems
      SET
        name = @name,
        slug = @slug,
        description = @description,
        url = @url,
        position = @position,
        is_active = @is_active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `),
    insertUser: db.prepare(`
      INSERT INTO users (name, email, password_hash, role, secretaria_id, is_active, updated_at)
      VALUES (@name, @email, @password_hash, @role, @secretaria_id, @is_active, CURRENT_TIMESTAMP)
    `),
    updateUserWithoutPassword: db.prepare(`
      UPDATE users
      SET
        name = @name,
        email = @email,
        role = @role,
        secretaria_id = @secretaria_id,
        is_active = @is_active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `),
    updateUserWithPassword: db.prepare(`
      UPDATE users
      SET
        name = @name,
        email = @email,
        role = @role,
        secretaria_id = @secretaria_id,
        is_active = @is_active,
        password_hash = @password_hash,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `),
    clearAssignments: db.prepare("DELETE FROM secretaria_systems WHERE secretaria_id = ?"),
    insertAssignment: db.prepare(`
      INSERT INTO secretaria_systems (secretaria_id, system_id, display_order)
      VALUES (?, ?, ?)
    `),
  };

  const replaceSecretariaSystems = db.transaction((secretariaId, items) => {
    statements.clearAssignments.run(secretariaId);
    items.forEach((item) => {
      statements.insertAssignment.run(secretariaId, item.systemId, item.displayOrder);
    });
  });

  return {
    db,
    slugify,
    getUserByEmail(email) {
      return statements.userByEmail.get(email);
    },
    getUserById(id) {
      return mapUser(statements.userById.get(id));
    },
    getRawUserById(id) {
      return statements.userById.get(id);
    },
    listSecretarias() {
      return statements.allSecretarias.all().map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        isActive: Boolean(item.is_active),
      }));
    },
    listSystems() {
      return statements.allSystems.all().map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        url: item.url,
        position: item.position,
        isActive: Boolean(item.is_active),
      }));
    },
    listUsers() {
      return statements.allUsers.all().map((item) => ({
        ...mapUser(item),
      }));
    },
    listAssignments() {
      return statements.assignmentsBySecretaria.all().map((item) => ({
        secretariaId: item.secretaria_id,
        systemId: item.system_id,
        displayOrder: item.display_order,
      }));
    },
    getSystemsForUser(user) {
      if (!user) return [];

      if (user.role === "admin") {
        return this.listSystems().filter((item) => item.isActive);
      }

      if (!user.secretariaId) return [];

      return statements.systemsForSecretaria.all(user.secretariaId).map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        url: item.url,
        position: item.display_order,
        isActive: Boolean(item.is_active),
      }));
    },
    createSecretaria(payload) {
      const result = statements.insertSecretaria.run({
        name: payload.name,
        slug: payload.slug,
        is_active: boolToInt(payload.isActive),
      });

      return this.listSecretarias().find((item) => item.id === result.lastInsertRowid);
    },
    updateSecretaria(payload) {
      statements.updateSecretaria.run({
        id: payload.id,
        name: payload.name,
        slug: payload.slug,
        is_active: boolToInt(payload.isActive),
      });

      return this.listSecretarias().find((item) => item.id === payload.id);
    },
    createSystem(payload) {
      const result = statements.insertSystem.run({
        name: payload.name,
        slug: payload.slug,
        description: payload.description || "",
        url: payload.url || "",
        position: payload.position,
        is_active: boolToInt(payload.isActive),
      });

      return this.listSystems().find((item) => item.id === result.lastInsertRowid);
    },
    updateSystem(payload) {
      statements.updateSystem.run({
        id: payload.id,
        name: payload.name,
        slug: payload.slug,
        description: payload.description || "",
        url: payload.url || "",
        position: payload.position,
        is_active: boolToInt(payload.isActive),
      });

      return this.listSystems().find((item) => item.id === payload.id);
    },
    createUser(payload) {
      const result = statements.insertUser.run({
        name: payload.name,
        email: payload.email,
        password_hash: bcrypt.hashSync(payload.password, 10),
        role: payload.role,
        secretaria_id: payload.secretariaId || null,
        is_active: boolToInt(payload.isActive),
      });

      return this.listUsers().find((item) => item.id === result.lastInsertRowid);
    },
    updateUser(payload) {
      const baseParams = {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        secretaria_id: payload.secretariaId || null,
        is_active: boolToInt(payload.isActive),
      };

      if (payload.password) {
        statements.updateUserWithPassword.run({
          ...baseParams,
          password_hash: bcrypt.hashSync(payload.password, 10),
        });
      } else {
        statements.updateUserWithoutPassword.run(baseParams);
      }

      return this.listUsers().find((item) => item.id === payload.id);
    },
    replaceSecretariaSystems(secretariaId, items) {
      replaceSecretariaSystems(secretariaId, items);
      return this.listAssignments().filter((item) => item.secretariaId === secretariaId);
    },
  };
}

module.exports = {
  createDatabase,
  slugify,
  mapUser,
};
