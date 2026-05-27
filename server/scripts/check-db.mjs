import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const Database = require('../node_modules/libsql/index.js')

const dbPath = path.join(__dirname, '../data.db')
const db = new Database(dbPath)

const orgs = db.prepare('SELECT * FROM organizations WHERE name = ?').all('ASD')
console.log('ASD orgs:', JSON.stringify(orgs))

const orgById = db.prepare('SELECT * FROM organizations WHERE id = 53').get()
console.log('Org by id 53:', JSON.stringify(orgById))

const cols = db.prepare('PRAGMA table_info(users)').all()
console.log('user cols:', cols.map(c => c.name).join(', '))

// Try inserting user directly
try {
  const org = db.prepare('SELECT id FROM organizations WHERE slug = ?').get('asd')
  console.log('org.id:', org?.id)
  const r = db.prepare(
    'INSERT INTO users (name, email, role, organization_id) VALUES (?, ?, ?, ?)'
  ).run('Super Admin', 'superadmin@admin.local', 'super_admin', org?.id)
  console.log('User insert result:', JSON.stringify(r))
} catch (e) {
  console.error('Error inserting user:', e.message)
}

const u = db.prepare('SELECT * FROM users WHERE role = ?').all('super_admin')
console.log('super_admin users:', JSON.stringify(u))

db.close()
