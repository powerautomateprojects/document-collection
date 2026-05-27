import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const Database = require('../node_modules/libsql/index.js')

const db = new Database(path.join(__dirname, '../data.db'))

// Check which tables reference users_old
const broken = db.prepare(
  "SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%users_old%'"
).all()
console.log('Tables referencing users_old:', broken.map(t => t.name).join(', '))
broken.forEach(t => console.log(`\n${t.name}:\n${t.sql}`))

db.close()
