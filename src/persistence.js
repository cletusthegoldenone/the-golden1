const fs = require('fs');
const path = require('path');

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
    path: absolutePath
  };
}

module.exports = {
  createFilePersistence
};
