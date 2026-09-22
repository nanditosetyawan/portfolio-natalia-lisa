import fs from 'fs'
import path from 'path'

// Read .env file manually
const envPath = path.join(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (match) {
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL
const apiKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY

console.log('Testing connection to Supabase URL:', supabaseUrl)

if (!supabaseUrl || !apiKey) {
  console.error('ERROR: Supabase URL or Anon Key missing from .env')
  process.exit(1)
}

async function testConnection() {
  try {
    // 1. Test basic RPC or Table query
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_active_published_snapshot`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    })
    
    console.log('RPC get_active_published_snapshot status:', res.status)
    if (res.ok) {
      const data = await res.json()
      console.log('Active published snapshot count:', data ? data.length : 0)
    } else {
      console.log('RPC Response body:', await res.text())
    }

    // 2. Test reading site_revisions table or health
    const revRes = await fetch(`${supabaseUrl}/rest/v1/site_revisions?select=id,status,revision_number,updated_at&limit=5`, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    })
    console.log('Table site_revisions select status:', revRes.status)
    if (revRes.ok) {
      const rows = await revRes.json()
      console.log('site_revisions sample rows:', rows)
    } else {
      console.log('site_revisions response error:', await revRes.text())
    }
  } catch (err) {
    console.error('Connection error:', err)
  }
}

testConnection()
