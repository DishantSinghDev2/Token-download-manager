import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined');
  }

  const client = new MongoClient(uri);
  const db = client.db(process.env.MONGODB_DB || 'token_download_manager');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

// Initialize indexes
export async function initializeIndexes(): Promise<void> {
  const db = await getDb();

  // Tokens collection
  await db.collection('tokens').createIndex({ token: 1 }, { unique: true });
  await db.collection('tokens').createIndex({ expiryDate: 1 });
  await db.collection('tokens').createIndex({ status: 1 });

  // Downloads collection
  await db.collection('downloads').createIndex({ tokenId: 1 });
  await db.collection('downloads').createIndex({ status: 1 });
  await db.collection('downloads').createIndex({ createdAt: 1 });

  // Admin users
  await db.collection('admins').createIndex({ email: 1 }, { unique: true });

  // VM stats
  await db.collection('vm_stats').createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

  // IP logs
  await db.collection('ip_logs').createIndex({ tokenId: 1 });
  await db.collection('ip_logs').createIndex({ ip: 1 });
  await db.collection('ip_logs').createIndex({ timestamp: 1 });
}
