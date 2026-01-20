import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateAdmin } from "./auth";

export const authConfig: NextAuthOptions = {
  pages: {
    signIn: "/admin/login",
  },

  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await authenticateAdmin(
          credentials.email,
          credentials.password
        );

        if (!admin) return null;

        return {
          id: admin.email,
          email: admin.email,
          name: admin.email,
          role: admin.role,
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }: any) {
      if (user?.role) token.role = user.role;
      return token;
    },

    async session({ session, token }: any) {
      if (session?.user) (session.user as any).role = token.role;
      return session;
    },
  },
};
