const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/token-download-manager';
const INITIAL_ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL;
const INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD;

async function initializeAdmin() {
  if (!INITIAL_ADMIN_EMAIL || !INITIAL_ADMIN_PASSWORD) {
    console.log('No initial admin credentials provided, skipping admin creation');
    return;
  }

  let client;
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Check if admin already exists
    const existingAdmin = await db.collection('admins').findOne({ email: INITIAL_ADMIN_EMAIL });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin
    console.log('Creating admin user...');
    const passwordHash = await bcrypt.hash(INITIAL_ADMIN_PASSWORD, 10);
    const admin = {
      email: INITIAL_ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      createdAt: new Date(),
    };

    await db.collection('admins').insertOne(admin);
    console.log(`✓ Admin user created: ${INITIAL_ADMIN_EMAIL}`);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run initialization
initializeAdmin()
  .then(() => {
    console.log('Initialization complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Initialization failed:', error);
    process.exit(1);
  });