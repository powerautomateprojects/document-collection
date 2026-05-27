import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const Database = require('../node_modules/libsql/index.js')

const db = new Database(path.join(__dirname, '../data.db'))

// Check user count
const count = db.prepare('SELECT COUNT(*) AS n FROM users').get()
console.log('User count:', count?.n)

// Check existing users
const users = db.prepare('SELECT id, name, email, role, organization_id FROM users ORDER BY id').all()
console.log('Users:', JSON.stringify(users))

// Check org
const org = db.prepare("SELECT id, name, slug FROM organizations WHERE slug = 'asd'").get()
console.log('ASD org:', JSON.stringify(org))

if (org) {
  // Check if super admin already exists
  const existing = db.prepare("SELECT id FROM users WHERE email = 'superadmin@admin.local'").get()
  if (existing) {
    console.log('Super Admin user already exists:', JSON.stringify(existing))
  } else {
    const r = db.prepare(
      "INSERT INTO users (name, email, role, organization_id) VALUES ('Super Admin', 'superadmin@admin.local', 'super_admin', ?)"
    ).run(org.id)
    console.log('Inserted Super Admin, id:', r.lastInsertRowid)
  }
}

db.close()
console.log('Done')
