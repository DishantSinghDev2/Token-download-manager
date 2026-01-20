import { getDb } from '../lib/db';
import { createAdmin } from '../lib/auth';

/**
 * Initialize default admin user
 * Run this to set up the first admin account
 */

async function initAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'change-me-in-production';

    console.log('🔄 Creating admin user...');

    const admin = await createAdmin(email, password, 'superadmin');

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`\n   Access admin panel at: https://faster.p.dishis.tech/admin/login`);
  } catch (error: any) {
    if (error.code === 11000) {
      console.log('⚠️  Admin user already exists');
    } else {
      console.error('❌ Error creating admin:', error.message);
      process.exit(1);
    }
  } finally {
    process.exit(0);
  }
}

initAdmin();
