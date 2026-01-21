import bcrypt from 'bcryptjs'
import { getDb } from '../lib/mongodb'
import { Admin } from '../lib/models'

async function initializeAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL
  const password = process.env.INITIAL_ADMIN_PASSWORD

  if (!email || !password) {
    console.log('No initial admin credentials provided, skipping admin creation')
    return
  }

  try {
    const db = await getDb()
    
    // Check if admin already exists
    const existingAdmin = await db.collection<Admin>('admins').findOne({ email })
    
    if (existingAdmin) {
      console.log('Admin user already exists')
      return
    }

    // Create admin
    const passwordHash = await bcrypt.hash(password, 10)
    const admin: Admin = {
      email,
      passwordHash,
      role: 'admin',
      createdAt: new Date(),
    }

    await db.collection<Admin>('admins').insertOne(admin)
    console.log(`Admin user created: ${email}`)
  } catch (error) {
    console.error('Error creating admin user:', error)
  }
}

// Run initialization
initializeAdmin().then(() => {
  console.log('Initialization complete')
  process.exit(0)
}).catch((error) => {
  console.error('Initialization failed:', error)
  process.exit(1)
})
