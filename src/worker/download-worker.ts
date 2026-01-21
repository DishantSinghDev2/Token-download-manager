import { Worker, Job } from 'bullmq'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { getDb, ObjectId } from '../lib/mongodb'
import { getRedisClient } from '../lib/redis'
import { Download } from '../lib/models'
import { DownloadJobData } from '../lib/queue'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = parseInt(process.env.REDIS_PORT || '6379')
const redisPassword = process.env.REDIS_PASSWORD

const connection = {
  host: redisHost,
  port: redisPort,
  password: redisPassword || undefined,
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://faster.p.dishis.tech'
const MIN_REAL_FILE_BYTES = parseInt(process.env.MIN_REAL_FILE_BYTES || `${5 * 1024 * 1024}`) // 5MB

function isTorrentUrl(url: string): boolean {
  return url.startsWith('magnet:') || url.endsWith('.torrent')
}

function parseSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/^([0-9.]+)([KMG]?i?B)$/)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2]

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1000,
    KiB: 1024,
    MB: 1000 * 1000,
    MiB: 1024 * 1024,
    GB: 1000 * 1000 * 1000,
    GiB: 1024 * 1024 * 1024,
  }

  return Math.floor(value * (multipliers[unit] || 1))
}

async function resolveFinalUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    return res.url || url
  } catch {
    return url
  }
}

function getDefaultClientHeaders(referer?: string) {
  const ua =
    process.env.DOWNLOAD_UA ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

  const ref = referer || process.env.DOWNLOAD_REFERER || 'https://www.google.com/'

  return {
    ua,
    referer: ref,
    ariaArgs: [
      `--user-agent=${ua}`,
      `--referer=${ref}`,
      '--header=Accept: */*',
      '--header=Connection: keep-alive',
    ],
  }
}

function shouldBrowserFallback(status: number | null) {
  if (!status) return false
  return [498, 429, 403, 401, 400, 451].includes(status)
}

function isProbablyRealFileResponse(headers: Record<string, string>, status: number) {
  const ct = (headers['content-type'] || '').toLowerCase()
  const cd = (headers['content-disposition'] || '').toLowerCase()
  const clRaw = headers['content-length'] || ''
  const cl = clRaw ? parseInt(clRaw) : 0

  if (![200, 206].includes(status)) return false

  if (cd.includes('attachment')) return true
  if (cl && cl >= MIN_REAL_FILE_BYTES) return true

  if (
    ct.includes('application/octet-stream') ||
    ct.includes('application/zip') ||
    ct.includes('application/x-rar') ||
    ct.includes('video/') ||
    ct.includes('audio/')
  ) {
    return true
  }

  return false
}

function isBadUrl(u: string) {
  const x = u.toLowerCase()
  return (
    x.includes('xadsmart') ||
    x.includes('doubleclick') ||
    x.includes('googlesyndication') ||
    x.includes('adsystem') ||
    x.includes('popads') ||
    x.includes('/ads') ||
    x.includes('analytics')
  )
}

function extractUrlFromAnyText(t: string): string | null {
  const s = (t || '').trim()
  if (!s) return null

  try {
    const j: any = JSON.parse(s)
    const url =
      j?.url ||
      j?.data?.url ||
      j?.result?.url ||
      j?.download ||
      j?.downloadUrl ||
      j?.file ||
      j?.direct ||
      j?.link
    if (typeof url === 'string' && url.startsWith('http')) return url
  } catch {}

  const m1 = s.match(/['"]url['"]\s*:\s*['"]([^'"]+)['"]/i)
  if (m1?.[1] && m1[1].startsWith('http')) return m1[1]

  const m2 = s.match(/https?:\/\/[^\s"'<>]+/i)
  if (m2?.[0]) return m2[0]

  return null
}

async function resolveWithBrowser(
  url: string
): Promise<{ directUrl: string; cookies?: string; referer?: string }> {
  const { chromium } = await import('playwright')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext({
    userAgent: getDefaultClientHeaders().ua,
  })

  const page = await context.newPage()

  await page.route('**/*', async (route) => {
    const reqUrl = route.request().url()
    if (isBadUrl(reqUrl)) return route.abort()
    return route.continue()
  })

  let directUrl: string | null = null
  let directReferer: string | undefined

  page.on('response', async (res) => {
    try {
      const u = res.url()
      if (!u.startsWith('http')) return
      if (isBadUrl(u)) return

      const status = res.status()
      const headers = res.headers()

      if (isProbablyRealFileResponse(headers, status)) {
        directUrl = u
        directReferer = page.url()
        return
      }

      const ct = (headers['content-type'] || '').toLowerCase()
      if (ct.includes('application/json') || ct.includes('text/javascript') || ct.includes('text/plain')) {
        const body = await res.text().catch(() => '')
        const extracted = extractUrlFromAnyText(body)
        if (extracted && extracted.startsWith('http') && !isBadUrl(extracted)) {
          directUrl = extracted
          directReferer = page.url()
        }
      }
    } catch {}
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  // timers, anti-bot, etc.
  await page.waitForTimeout(12_000)

  const tryClicks = [
    'a[download]',
    'a[href*="download"]',
    'button:has-text("Download")',
    'a:has-text("Download")',
    'button:has-text("Free Download")',
    'a:has-text("Free Download")',
  ]

  for (const sel of tryClicks) {
    if (directUrl) break
    try {
      const el = await page.$(sel)
      if (!el) continue

      const dl = await Promise.race([
        page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
        (async () => {
          await el.click({ timeout: 3000 })
          return null
        })(),
      ])

      if (dl) {
        const u = dl.url()
        if (u && !isBadUrl(u)) {
          directUrl = u
          directReferer = page.url()
          break
        }
      }

      await page.waitForTimeout(10_000)
    } catch {}
  }

  // longer wait for API token generation
  if (!directUrl) {
    await page.waitForTimeout(20_000)
  }

  if (!directUrl) {
    try {
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') || ''))

      const guess = hrefs
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => {
          try {
            return new URL(h, url).toString()
          } catch {
            return ''
          }
        })
        .find((h) => {
          const x = h.toLowerCase()
          if (!x.startsWith('http')) return false
          if (isBadUrl(x)) return false
          return x.includes('download') || x.includes('.zip') || x.includes('.mp4') || x.includes('.mkv')
        })

      if (guess) {
        directUrl = guess
        directReferer = page.url()
      }
    } catch {}
  }

  const cookiesArr = await context.cookies()
  await browser.close()

  if (!directUrl) {
    throw new Error('Browser fallback could not resolve direct file URL (blocked/JS locked)')
  }

  const cookieHeader =
    cookiesArr.length > 0 ? cookiesArr.map((c) => `${c.name}=${c.value}`).join('; ') : undefined

  return { directUrl, cookies: cookieHeader, referer: directReferer }
}

async function aria2Download(opts: {
  url: string
  downloadPath: string
  out?: string
  headers?: string[]
}) {
  await fs.mkdir(opts.downloadPath, { recursive: true })

  const args = [
    ...(opts.headers || []),
    '--split=16',
    '--max-connection-per-server=16',
    '--min-split-size=1M',
    '--file-allocation=none',
    '--summary-interval=1',
    '--continue=true',
    '--allow-overwrite=true',
    `--dir=${opts.downloadPath}`,
  ]

  if (opts.out) args.push(`--out=${opts.out}`)
  args.push(opts.url)

  const p = spawn('aria2c', args)

  p.stdout.on('data', (d) => console.log(`aria2c stdout: ${d.toString()}`))
  p.stderr.on('data', (d) => console.error(`aria2c stderr: ${d.toString()}`))

  const code = await new Promise<number>((resolve) => p.on('close', (c) => resolve(c ?? 0)))
  if (code !== 0) throw new Error(`aria2c (browser url) exited with code ${code}`)
}

async function processDownload(job: Job<DownloadJobData>) {
  const { downloadId, tokenId, inputUrl, filename, downloadPath } = job.data

  console.log(`Processing download ${downloadId}`)

  const db = await getDb()
  const redis = await getRedisClient()

  try {
    await db.collection<Download>('downloads').updateOne(
      { _id: new ObjectId(downloadId) },
      { $set: { status: 'downloading', updatedAt: new Date() } }
    )

    await fs.mkdir(downloadPath, { recursive: true })

    const isTorrent = isTorrentUrl(inputUrl)
    const baseHeaders = getDefaultClientHeaders()

    let redirectedUrl: string | null = null
    let seeders = 0
    let peers = 0
    let uploadSpeed = 0

    if (!isTorrent) {
      const finalUrl = await resolveFinalUrl(inputUrl)
      if (finalUrl && finalUrl !== inputUrl) {
        redirectedUrl = finalUrl
        await db.collection<Download>('downloads').updateOne(
          { _id: new ObjectId(downloadId) },
          { $set: { redirectedUrl, updatedAt: new Date() } }
        )
      }
    }

    const finalUrl = redirectedUrl || inputUrl

    const aria2cArgs = isTorrent
      ? [
          '--enable-dht=true',
          '--bt-enable-lpd=true',
          '--enable-peer-exchange=true',
          '--seed-time=0',
          '--bt-max-peers=100',
          '--bt-request-peer-speed-limit=10M',
          '--max-upload-limit=1K',
          '--bt-seed-unverified=false',
          '--bt-save-metadata=true',
          '--bt-hash-check-seed=true',
          '--bt-detach-seed-only=true',
          '--listen-port=6881-6889',
          '--dht-listen-port=6881-6889',
          '--follow-torrent=mem',
          '--split=16',
          '--max-connection-per-server=16',
          '--min-split-size=1M',
          '--file-allocation=none',
          '--summary-interval=1',
          '--continue=true',
          '--allow-overwrite=true',
          `--dir=${downloadPath}`,
          finalUrl,
        ]
      : [
          ...baseHeaders.ariaArgs,
          '--split=16',
          '--max-connection-per-server=16',
          '--min-split-size=1M',
          '--file-allocation=none',
          '--summary-interval=1',
          '--continue=true',
          '--allow-overwrite=true',
          `--dir=${downloadPath}`,
          `--out=${filename}`,
          finalUrl,
        ]

    const aria2c = spawn('aria2c', aria2cArgs)

    let lastRedisUpdate = Date.now()
    let lastMongoUpdate = Date.now()

    let totalBytes = 0
    let downloadedBytes = 0
    let speed = 0

    let lastHttpStatus: number | null = null
    let shouldBrowser = false

    aria2c.stdout.on('data', async (data) => {
      const output = data.toString()
      console.log(`aria2c stdout: ${output}`)

      const statusMatch = output.match(/status=(\d{3})/)
      if (statusMatch) {
        lastHttpStatus = parseInt(statusMatch[1])
        if (shouldBrowserFallback(lastHttpStatus)) shouldBrowser = true
      }

      const redirectMatch =
        output.match(/Redirecting to (https?:\/\/\S+)/i) ||
        output.match(/Location:\s*(https?:\/\/\S+)/i)

      if (redirectMatch) {
        redirectedUrl = redirectMatch[1].trim() || ''
        await db.collection<Download>('downloads').updateOne(
          { _id: new ObjectId(downloadId) },
          { $set: { redirectedUrl, updatedAt: new Date() } }
        )
      }

      if (isTorrent) {
        const seedersMatch = output.match(/SEEDER:(\d+)/)
        const peersMatch = output.match(/PEER:(\d+)/)
        const uploadMatch = output.match(/UP:([0-9.]+[KMG]?i?B)/)

        if (seedersMatch) seeders = parseInt(seedersMatch[1])
        if (peersMatch) peers = parseInt(peersMatch[1])
        if (uploadMatch) uploadSpeed = parseSizeToBytes(uploadMatch[1])
      }

      const downloadMatch = output.match(/\((\d+)%\)/)
      const speedMatch = output.match(/DL:([0-9.]+[KMG]?i?B)/)
      const sizeMatch = output.match(/SIZE:([0-9.]+[KMG]?i?B)/)
      const completedMatch = output.match(/(\d+[KMG]?i?B)\/(\d+[KMG]?i?B)/)

      if (completedMatch) {
        downloadedBytes = parseSizeToBytes(completedMatch[1])
        totalBytes = parseSizeToBytes(completedMatch[2])
      } else if (sizeMatch) totalBytes = parseSizeToBytes(sizeMatch[1])

      if (downloadMatch && totalBytes > 0) {
        const percentage = parseInt(downloadMatch[1])
        downloadedBytes = Math.floor((percentage / 100) * totalBytes)
      }

      if (speedMatch) speed = parseSizeToBytes(speedMatch[1])

      const now = Date.now()

      if (now - lastRedisUpdate >= 1000) {
        const eta = speed > 0 ? (totalBytes - downloadedBytes) / speed : 0

        const progress: any = {
          downloadId,
          status: 'downloading',
          totalBytes,
          downloadedBytes,
          speed,
          eta,
          updatedAt: now,
        }

        if (redirectedUrl) progress.redirectedUrl = redirectedUrl
        if (isTorrent) progress.torrentInfo = { seeders, peers, uploadSpeed }

        await redis.setEx(`download:progress:${downloadId}`, 300, JSON.stringify(progress))
        lastRedisUpdate = now
      }

      if (now - lastMongoUpdate >= 5000) {
        const eta = speed > 0 ? (totalBytes - downloadedBytes) / speed : 0
        const updateData: any = { totalBytes, downloadedBytes, speed, eta, updatedAt: new Date() }

        if (redirectedUrl) updateData.redirectedUrl = redirectedUrl
        if (isTorrent) updateData.torrentInfo = { seeders, peers, uploadSpeed }

        await db.collection<Download>('downloads').updateOne(
          { _id: new ObjectId(downloadId) },
          { $set: updateData }
        )
        lastMongoUpdate = now
      }
    })

    aria2c.stderr.on('data', (data) => {
      const s = data.toString()
      console.error(`aria2c stderr: ${s}`)

      const statusMatch = s.match(/status=(\d{3})/)
      if (statusMatch) {
        lastHttpStatus = parseInt(statusMatch[1])
        if (shouldBrowserFallback(lastHttpStatus)) shouldBrowser = true
      }
    })

    const exitCode = await new Promise<number>((resolve) => {
      aria2c.on('close', (code) => resolve(code || 0))
    })

    if (!isTorrent && (shouldBrowser || exitCode !== 0)) {
      console.log(`aria2 blocked status=${lastHttpStatus}, using playwright fallback...`)

      const { directUrl, cookies, referer } = await resolveWithBrowser(finalUrl)

      await db.collection<Download>('downloads').updateOne(
        { _id: new ObjectId(downloadId) },
        { $set: { redirectedUrl: directUrl, updatedAt: new Date() } }
      )

      const headerArgs = [
        ...getDefaultClientHeaders(referer).ariaArgs,
        ...(cookies ? [`--header=Cookie: ${cookies}`] : []),
      ]

      await aria2Download({
        url: directUrl,
        downloadPath,
        out: filename,
        headers: headerArgs,
      })
    } else if (exitCode !== 0) {
      throw new Error(`aria2c exited with code ${exitCode}`)
    }

    const files = await fs.readdir(downloadPath)
    const downloadedFile = files.find((f) => !f.endsWith('.aria2') && f !== '.aria2') || filename

    const finalOutputFile = path.join(downloadPath, downloadedFile)
    const stats = await fs.stat(finalOutputFile)

    if (stats.size < MIN_REAL_FILE_BYTES) {
      throw new Error(
        `Downloaded file too small (${stats.size} bytes). Probably ad/api response, not real file.`
      )
    }

    const publicUrl = `${APP_URL}/d/${path.basename(
      path.dirname(downloadPath)
    )}/${downloadId}/${downloadedFile}`

    await db.collection<Download>('downloads').updateOne(
      { _id: new ObjectId(downloadId) },
      {
        $set: {
          status: 'completed',
          filename: downloadedFile,
          totalBytes: stats.size,
          downloadedBytes: stats.size,
          publicUrl,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    await db.collection('tokens').updateOne(
      { _id: new ObjectId(tokenId) },
      { $inc: { usedBytes: stats.size }, $set: { updatedAt: new Date() } }
    )

    await redis.del(`download:progress:${downloadId}`)
    console.log(`Download ${downloadId} completed successfully`)
  } catch (error: any) {
    console.error(`Download ${downloadId} failed:`, error)

    await db.collection<Download>('downloads').updateOne(
      { _id: new ObjectId(downloadId) },
      { $set: { status: 'failed', errorMessage: error.message, updatedAt: new Date() } }
    )

    await redis.del(`download:progress:${downloadId}`)
    throw error
  }
}

const worker = new Worker<DownloadJobData>('downloads', processDownload, {
  connection,
  concurrency: 3,
  limiter: { max: 10, duration: 1000 },
})

worker.on('completed', (job) => console.log(`Job ${job.id} completed`))
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err))

console.log('Download worker started')

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...')
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...')
  await worker.close()
  process.exit(0)
})
