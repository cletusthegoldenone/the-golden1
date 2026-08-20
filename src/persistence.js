const fs = require('fs');
const path = require('path');

class PersistenceError extends Error {
  constructor(reasonCode, message = reasonCode) {
    super(message);
    this.reasonCode = reasonCode;
  }
}

function createFilePersistence(filePath) {
  const absolutePath = path.resolve(filePath);

  return {
    load() {
      if (!fs.existsSync(absolutePath)) return null;
      const raw = fs.readFileSync(absolutePath, 'utf8');
      if (!raw.trim()) return null;
      return JSON.parse(raw);
    },
    save(snapshot) {
      const dir = path.dirname(absolutePath);
      fs.mkdirSync(dir, { recursive: true });
      const tmpPath = `${absolutePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2));
      fs.renameSync(tmpPath, absolutePath);
    },
    clear() {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    },
    health() {
      return { ok: true, adapter: 'file', path: absolutePath };
    },
    path: absolutePath
  };
}

function createPostgresPersistence(connectionString) {
  const configured = typeof connectionString === 'string' && connectionString.trim().length > 0;

  function unavailable() {
    if (!configured) {
      throw new PersistenceError('PERSISTENCE_CONFIG_INVALID', 'DATABASE_URL is required for postgres adapter');
    }
    throw new PersistenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Postgres adapter scaffold is enabled but no runtime driver is wired yet'
    );
  }

  return {
    load() {
      unavailable();
    },
    save() {
      unavailable();
    },
    clear() {
      unavailable();
    },
    health() {
      if (!configured) return { ok: false, adapter: 'postgres', reasonCode: 'PERSISTENCE_CONFIG_INVALID' };
      return { ok: false, adapter: 'postgres', reasonCode: 'PERSISTENCE_UNAVAILABLE' };
    },
    withTransaction() {
      unavailable();
    }
  };
}

module.exports = {
  PersistenceError,
  createFilePersistence,
  createPostgresPersistence
};
