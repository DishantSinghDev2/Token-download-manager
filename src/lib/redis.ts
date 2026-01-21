import { createClient } from 'redis'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = parseInt(process.env.REDIS_PORT || '6379')
const redisPassword = process.env.REDIS_PASSWORD

let client: ReturnType<typeof createClient> | null = null

export async function getRedisClient() {
  if (client) {
    return client
  }

  client = createClient({
    socket: {
      host: redisHost,
      port: redisPort,
    },
    password: redisPassword || undefined,
  })

  client.on('error', (err) => console.error('Redis Client Error', err))

  await client.connect()
  return client
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = await getRedisClient()
    const response = await client.ping()
    return response === 'PONG'
  } catch (error) {
    console.error('Redis health check failed:', error)
    return false
  }
}
