const path = require('path');
const fs = require('fs').promises;
const defaultRoot = path.resolve(__dirname, '../../uploads');
const uploadsRoot = path.resolve(process.env.UPLOADS_DIR || defaultRoot);
const resumesDirectory = path.join(uploadsRoot, 'resumes');
const recordingsDirectory = path.join(uploadsRoot, 'recordings');

function isWithin(filename, root) {
    const relative = path.relative(root, path.resolve(filename));
    return Boolean(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
function isManagedPath(filename) {
  return [uploadsRoot, defaultRoot].some(root => isWithin(filename, root));
}
async function isManagedFile(filename) {
  if (!isManagedPath(filename)) return false;
  let physicalFile;
  try { physicalFile = await fs.realpath(filename); }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
  for (const root of [uploadsRoot, defaultRoot]) {
    try { if (isWithin(physicalFile, await fs.realpath(root))) return true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return false;
}
module.exports = { defaultRoot, uploadsRoot, resumesDirectory, recordingsDirectory, isManagedPath, isManagedFile };
