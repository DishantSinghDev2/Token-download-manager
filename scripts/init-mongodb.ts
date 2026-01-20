import { MongoClient } from 'mongodb';

/**
 * MongoDB initialization script
 * Run this script to set up collections, indexes, and initial admin user
 */

async function initializeDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://mongo:27017';
  const dbName = process.env.MONGODB_DB || 'token_download_manager';
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    console.log('🔄 Initializing MongoDB collections and indexes...');

    // Create collections with validation
    const collections = [
      'admins',
      'tokens',
      'downloads',
      'token_usage',
      'ip_logs',
      'vm_stats',
      'admin_logs',
      'suspicious_activities',
    ];

    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName);
        console.log(`✅ Created collection: ${collectionName}`);
      } catch (error: any) {
        if (error.codeName === 'NamespaceExists') {
          console.log(`⏭️  Collection already exists: ${collectionName}`);
        } else {
          throw error;
        }
      }
    }

    // Create indexes
    console.log('\n🔄 Creating indexes...');

    // Admins indexes
    await db.collection('admins').createIndex({ email: 1 }, { unique: true });
    console.log('✅ Created admins.email index');

    // Tokens indexes
    await db.collection('tokens').createIndex({ token: 1 }, { unique: true });
    await db.collection('tokens').createIndex({ expiryDate: 1 });
    await db.collection('tokens').createIndex({ status: 1 });
    console.log('✅ Created tokens indexes');

    // Downloads indexes
    await db.collection('downloads').createIndex({ tokenId: 1 });
    await db.collection('downloads').createIndex({ status: 1 });
    await db.collection('downloads').createIndex({ createdAt: 1 });
    await db.collection('downloads').createIndex({ ip: 1 });
    console.log('✅ Created downloads indexes');

    // Token usage indexes
    await db.collection('token_usage').createIndex({ tokenId: 1 }, { unique: true });
    console.log('✅ Created token_usage indexes');

    // IP logs indexes
    await db.collection('ip_logs').createIndex({ tokenId: 1 });
    await db.collection('ip_logs').createIndex({ ip: 1 });
    await db.collection('ip_logs').createIndex({ timestamp: 1 });
    console.log('✅ Created ip_logs indexes');

    // VM stats indexes (with TTL)
    await db.collection('vm_stats').createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days
    console.log('✅ Created vm_stats indexes with TTL');

    // Admin logs indexes
    await db.collection('admin_logs').createIndex({ adminEmail: 1 });
    await db.collection('admin_logs').createIndex({ timestamp: 1 });
    console.log('✅ Created admin_logs indexes');

    // Suspicious activities indexes
    await db.collection('suspicious_activities').createIndex({ tokenId: 1 });
    await db.collection('suspicious_activities').createIndex({ timestamp: 1 });
    console.log('✅ Created suspicious_activities indexes');

    console.log('\n✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

initializeDatabase();
