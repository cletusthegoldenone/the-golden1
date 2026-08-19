const fs = require('fs');
const path = require('path');
const { createFilePersistence, createPostgresPersistence } = require('./persistence');
const { PERSISTENCE_ADAPTER, PERSISTENCE_FILE_PATH, DATABASE_URL } = require('./config');

function targetPersistence() {
  if (PERSISTENCE_ADAPTER === 'postgres') {
    return createPostgresPersistence(DATABASE_URL);
  }
  return createFilePersistence(PERSISTENCE_FILE_PATH);
}

function readSnapshotFromFile(filePath) {
  const absolute = path.resolve(filePath);
  const raw = fs.readFileSync(absolute, 'utf8');
  return JSON.parse(raw);
}

function main() {
  const sourceFile = process.env.MIGRATION_SOURCE_FILE;
  if (!sourceFile) {
    throw new Error('MIGRATION_SOURCE_FILE is required');
  }
  const snapshot = readSnapshotFromFile(sourceFile);
  const persistence = targetPersistence();
  persistence.save(snapshot);
}

if (require.main === module) {
  try {
    main();
    // eslint-disable-next-line no-console
    console.log('state_migration_complete');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('state_migration_failed', error.message);
    process.exitCode = 1;
  }
}

module.exports = { main };
