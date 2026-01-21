import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/mongodb'
import { Admin } from '@/lib/models'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const db = await getDb()
        const admin = await db.collection<Admin>('admins').findOne({
          email: credentials.email,
        })

        if (!admin) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          admin.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: admin._id!.toString(),
          email: admin.email,
          role: admin.role,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/admin/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
