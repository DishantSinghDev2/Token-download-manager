import { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authenticateAdmin } from './auth';

export const authConfig = {
  pages: {
    signIn: '/admin/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdminPage = request.nextUrl.pathname.startsWith('/admin');

      if (isOnAdminPage) {
        return isLoggedIn;
      }

      return true;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const admin = await authenticateAdmin(credentials.email as string, credentials.password as string);

        if (!admin) {
          throw new Error('Invalid email or password');
        }

        return {
          id: admin.email,
          email: admin.email,
          name: admin.email,
          role: admin.role,
        };
      },
    }),
  ],
} satisfies NextAuthConfig;
