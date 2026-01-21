import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { Token } from '@/lib/models'
import AdminNav from '@/components/admin-nav'
import TokensList from '@/components/tokens-list'
import CreateTokenDialog from '@/components/create-token-dialog'

async function getTokens() {
  const db = await getDb()
  const tokens = await db
    .collection<Token>('tokens')
    .find()
    .sort({ createdAt: -1 })
    .toArray()

  return tokens.map(token => ({
    ...token,
    _id: token._id!.toString(),
    createdAt: token.createdAt.toISOString(),
    updatedAt: token.updatedAt.toISOString(),
    expiresAt: token.expiresAt.toISOString(),
  }))
}

export default async function TokensPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/admin/login')
  }

  const tokens = await getTokens()

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Token Management</h1>
          <CreateTokenDialog />
        </div>
        
        <TokensList tokens={tokens} />
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
