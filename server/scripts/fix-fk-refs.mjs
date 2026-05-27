import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const Database = require('../node_modules/libsql/index.js')

const db = new Database(path.join(__dirname, '../data.db'))

// Fix broken FK references by updating sqlite_master directly
db.exec('PRAGMA writable_schema = ON')

const result = db.prepare(
  `UPDATE sqlite_master SET sql = REPLACE(sql, '"users_old"', 'users') WHERE type = 'table' AND sql LIKE '%users_old%'`
).run()
console.log('Fixed FK references in', result.changes, 'tables')

db.exec('PRAGMA writable_schema = RESET')

// Verify
const still_broken = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%users_old%'"
).all()
console.log('Still broken:', still_broken.length === 0 ? 'none' : still_broken.map(t => t.name).join(', '))

// Integrity check
const ic = db.prepare('PRAGMA integrity_check').all()
console.log('Integrity check:', ic.length === 1 && ic[0].integrity_check === 'ok' ? 'OK' : JSON.stringify(ic))

db.close()
console.log('Done')
