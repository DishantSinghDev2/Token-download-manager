import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { checkRedisHealth } from '@/lib/redis'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AdminNav from '@/components/admin-nav'

async function getDashboardStats() {
  const db = await getDb()
  
  const [activeDownloads, totalDownloads, redisHealthy] = await Promise.all([
    db.collection('downloads').countDocuments({ 
      status: { $in: ['queued', 'downloading'] } 
    }),
    db.collection('downloads').countDocuments(),
    checkRedisHealth(),
  ])
  
  let mongoHealthy = true
  try {
    await db.admin().ping()
  } catch (error) {
    mongoHealthy = false
  }

  return {
    activeDownloads,
    totalDownloads,
    redisHealthy,
    mongoHealthy,
  }
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/admin/login')
  }

  const stats = await getDashboardStats()

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Active Downloads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeDownloads}</div>
              <p className="text-xs text-muted-foreground">
                Currently downloading
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Total Downloads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDownloads}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Redis Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.redisHealthy ? 'text-green-600' : 'text-red-600'}`}>
                {stats.redisHealthy ? 'Healthy' : 'Unhealthy'}
              </div>
              <p className="text-xs text-muted-foreground">
                Connection status
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                MongoDB Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.mongoHealthy ? 'text-green-600' : 'text-red-600'}`}>
                {stats.mongoHealthy ? 'Healthy' : 'Unhealthy'}
              </div>
              <p className="text-xs text-muted-foreground">
                Connection status
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
