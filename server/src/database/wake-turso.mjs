import { createClient } from '@libsql/client'

const url = process.argv[2]
const authToken = process.argv[3]

if (!url || !authToken) process.exit(1)

try {
  const client = createClient({ url, authToken })
  await client.execute('SELECT 1')
  process.exit(0)
} catch {
  process.exit(1)
}
