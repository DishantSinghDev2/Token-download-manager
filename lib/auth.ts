import bcrypt from 'bcryptjs';
import { getDb } from './db';
import crypto from 'crypto';
import { Admin, Token } from './models';

// Generate secure random tokens
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Admin authentication
export async function createAdmin(email: string, password: string, role: 'superadmin' | 'admin' = 'admin'): Promise<Admin> {
  const db = await getDb();
  const passwordHash = await hashPassword(password);

  const result = await db.collection('admins').insertOne({
    email,
    passwordHash,
    role,
    createdAt: new Date(),
    disabled: false,
  });

  return {
    _id: result.insertedId,
    email,
    passwordHash,
    role,
    createdAt: new Date(),
    disabled: false,
  };
}

export async function authenticateAdmin(email: string, password: string): Promise<Admin | null> {
  const db = await getDb();
  const admin = await db.collection('admins').findOne({ email });

  if (!admin) {
    return null;
  }

  const isValid = await verifyPassword(password, admin.passwordHash);
  if (!isValid) {
    return null;
  }

  if (admin.disabled) {
    return null;
  }

  // Update last login
  await db.collection('admins').updateOne({ _id: admin._id }, { $set: { lastLogin: new Date() } });

  return admin as Admin;
}

export async function getAdmin(email: string): Promise<Admin | null> {
  const db = await getDb();
  return (await db.collection('admins').findOne({ email })) as Admin | null;
}

// Token management
export async function createToken(
  data: Omit<Token, '_id' | 'token' | 'passwordHash' | 'createdAt' | 'updatedAt'> & { password: string; createdBy: string }
): Promise<Token> {
  const db = await getDb();
  const token = generateSecureToken();
  const passwordHash = await hashPassword(data.password);

  const { password, ...tokenData } = data;

  const result = await db.collection('tokens').insertOne({
    token,
    passwordHash,
    ...tokenData,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    _id: result.insertedId,
    token,
    passwordHash,
    ...tokenData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function validateToken(token: string, password: string): Promise<Token | null> {
  const db = await getDb();
  const tokenDoc = await db.collection('tokens').findOne({ token });

  if (!tokenDoc) {
    return null;
  }

  // Check if token is expired
  if (new Date() > tokenDoc.expiryDate) {
    return null;
  }

  // Check if token is active
  if (tokenDoc.status !== 'active') {
    return null;
  }

  // Verify password
  const isValid = await verifyPassword(password, tokenDoc.passwordHash);
  if (!isValid) {
    return null;
  }

  return tokenDoc as Token;
}

export async function getTokenByString(token: string): Promise<Token | null> {
  const db = await getDb();
  return (await db.collection('tokens').findOne({ token })) as Token | null;
}

// URL validation for SSRF prevention
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254', // AWS metadata endpoint
];

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^fc[0-9a-f]{2}:/i, // IPv6 private
];

export async function validateDownloadUrl(urlString: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
    }

    // Check for blocked hosts
    if (BLOCKED_HOSTS.includes(url.hostname.toLowerCase())) {
      return { valid: false, error: 'This URL points to a restricted host' };
    }

    // Check for private IP ranges
    for (const range of PRIVATE_IP_RANGES) {
      if (range.test(url.hostname)) {
        return { valid: false, error: 'Private IP addresses are not allowed' };
      }
    }

    // Check domain length
    if (url.hostname.length > 255) {
      return { valid: false, error: 'Invalid hostname' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}
