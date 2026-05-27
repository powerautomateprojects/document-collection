import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const Database = require('../node_modules/libsql/index.js')

const db = new Database(path.join(__dirname, '../data.db'))

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
console.log('Tables:', tables.map(t => t.name).join(', '))

const usersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()
console.log('Users schema:', usersSql?.sql)

const usersOldSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users_old'").get()
console.log('Users_old schema:', usersOldSql?.sql)

db.close()
