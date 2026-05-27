import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const Database = require('../node_modules/libsql/index.js')

const dbPath = path.join(__dirname, '../data.db')
const db = new Database(dbPath)

// Insert org
const orgResult = db.prepare(
  'INSERT OR IGNORE INTO organizations (name, slug, description) VALUES (?, ?, ?)'
).run('ASD', 'asd', 'Administrative')
console.log('Org insert changes:', orgResult.changes)

// Get org id
const org = db.prepare("SELECT id FROM organizations WHERE slug = 'asd'").get()
console.log('Org:', org)

// Insert super_admin user
const userResult = db.prepare(
  'INSERT OR IGNORE INTO users (name, email, role, organization_id) VALUES (?, ?, ?, ?)'
).run('Super Admin', 'superadmin@admin.local', 'super_admin', org.id)
console.log('User insert changes:', userResult.changes)

const user = db.prepare("SELECT id, name, role, organization_id FROM users WHERE email = 'superadmin@admin.local'").get()
console.log('User:', user)

db.close()
console.log('Done')
