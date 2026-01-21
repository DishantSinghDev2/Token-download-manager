import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/mongodb'
import { Admin } from '@/lib/models'

export async function POST(request: NextRequest) {
  try {
    // Check if this is being called with the correct secret
    const { secret, email, password } = await request.json()
    
    if (secret !== process.env.NEXTAUTH_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const db = await getDb()
    
    // Check if admin already exists
    const existingAdmin = await db.collection<Admin>('admins').findOne({ email })
    
    if (existingAdmin) {
      return NextResponse.json({
        message: 'Admin user already exists',
        email: existingAdmin.email,
      })
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

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      email: admin.email,
    })
  } catch (error: any) {
    console.error('Error in init-admin:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
