import { notFound, redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { getDb, ObjectId } from '@/lib/mongodb'
import { Token, Download } from '@/lib/models'
import TokenPortal from '@/components/token-portal'

async function validateToken(token: string, password: string | null) {
  const db = await getDb()
  const tokenDoc = await db.collection<Token>('tokens').findOne({ token })

  if (!tokenDoc) {
    return null
  }

  // Check if token is active
  if (tokenDoc.status !== 'active') {
    return { error: 'Token is not active' }
  }

  // Check if expired
  if (new Date() > tokenDoc.expiresAt) {
    await db.collection('tokens').updateOne(
      { _id: tokenDoc._id },
      { $set: { status: 'expired', updatedAt: new Date() } }
    )
    return { error: 'Token has expired' }
  }

  // Check password
  if (!password) {
    return { requiresPassword: true }
  }

  const isPasswordValid = await bcrypt.compare(password, tokenDoc.passwordHash)
  if (!isPasswordValid) {
    return { error: 'Invalid password' }
  }

  return { tokenDoc }
}

async function getDownloads(tokenId: ObjectId) {
  const db = await getDb()
  const downloads = await db
    .collection<Download>('downloads')
    .find({ tokenId })
    .sort({ createdAt: -1 })
    .toArray()

  return downloads.map(d => ({
    ...d,
    _id: d._id!.toString(),
    tokenId: d.tokenId.toString(),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    completedAt: d.completedAt?.toISOString(),
  }))
}

export default async function TokenPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { p?: string }
}) {
  const { token } = params
  const password = searchParams.p || null

  const result = await validateToken(token, password)

  if (!result) {
    notFound()
  }

  if ('requiresPassword' in result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h1 className="text-2xl font-bold mb-4">Password Required</h1>
            <p className="text-gray-600 mb-4">
              This token requires a password. Please include it in the URL:
            </p>
            <code className="block bg-gray-100 p-3 rounded text-sm break-all">
              {process.env.NEXT_PUBLIC_APP_URL}/t/{token}?p=YOUR_PASSWORD
            </code>
          </div>
        </div>
      </div>
    )
  }

  if ('error' in result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
            <p className="text-gray-600">{result.error}</p>
          </div>
        </div>
      </div>
    )
  }

  const downloads = await getDownloads(result.tokenDoc._id!)

  return (
    <TokenPortal
      token={{
        ...result.tokenDoc,
        _id: result.tokenDoc._id!.toString(),
        createdAt: result.tokenDoc.createdAt.toISOString(),
        updatedAt: result.tokenDoc.updatedAt.toISOString(),
        expiresAt: result.tokenDoc.expiresAt.toISOString(),
      }}
      downloads={downloads}
    />
  )
}

export const dynamic = 'force-dynamic'
