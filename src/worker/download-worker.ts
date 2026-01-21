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

function looksLikeHtml(data: string) {
  const s = data.trim().toLowerCase()
  if (!s) return false

  return (
    s.startsWith('<!doctype html') ||
    s.startsWith('<html') ||
    s.includes('<script') ||
    s.includes('window.location') ||
    s.includes('document.location') ||
    s.includes('<meta') ||
    s.includes('</html>')
  )
}

function extractRedirectUrlFromHtml(html: string): string | null {
  const m1 = html.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i)
  if (m1?.[1]) return m1[1]

  const m2 = html.match(/location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i)
  if (m2?.[1]) return m2[1]

  const m3 = html.match(
    /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^;]+;\s*url=([^"'>\s]+)["']?/i
  )
  if (m3?.[1]) return m3[1]

  const m4 = html.match(/<a[^>]+href=['"]([^'"]+)['"][^>]*>\s*click/i)
  if (m4?.[1]) return m4[1]

  return null
}

async function readFirstBytes(file: string, max = 8000) {
  try {
    const buf = await fs.readFile(file)
    return buf.slice(0, max).toString('utf8')
  } catch {
    return ''
  }
}

function getDefaultClientHeaders(referer?: string) {
  const ua =
    process.env.DOWNLOAD_UA ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

  const ref =
    referer ||
    process.env.DOWNLOAD_REFERER ||
    'https://www.google.com/'

  return {
    ua,
    referer: ref,
    ariaArgs: [
      `--user-agent=${ua}`,
      `--referer=${ref}`,
      '--header=Accept: */*',
      '--header=Connection: keep-alive',
    ],
    curlArgs: ['-L', '-A', ua, '-e', ref],
  }
}

async function execCmd(cmd: string, args: string[]) {
  const p = spawn(cmd, args)

  let out = ''
  let err = ''

  p.stdout.on('data', (d) => (out += d.toString()))
  p.stderr.on('data', (d) => (err += d.toString()))

  const code = await new Promise<number>((resolve) => {
    p.on('close', (c) => resolve(c ?? 0))
  })

  return { code, out, err }
}

function shouldFallbackOnHttpStatus(status: number | null) {
  if (!status) return false
  return [498, 429, 403, 401, 400, 451].includes(status)
}

/**
 * The only real way to solve MixDrop/DoodStream/Filemoon/etc.
 * This tries to sniff the real file URL after JS runs.
 */
async function resolveWithBrowser(url: string): Promise<string> {
  const { chromium } = await import('playwright')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  let directUrl: string | null = null

  page.on('response', (res) => {
    try {
      const u = res.url()
      if (!u.startsWith('http')) return

      const status = res.status()
      const ct = (res.headers()['content-type'] || '').toLowerCase()

      const maybeFile =
        (status === 200 || status === 206) &&
        !ct.includes('text/html') &&
        !ct.includes('application/xhtml') &&
        !ct.includes('text/plain')

      if (maybeFile) directUrl = u
    } catch {}
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  // let scripts/timers do their thing
  await page.waitForTimeout(7000)

  // try some generic clicks
  const clickables = [
    'a[download]',
    'a[href*="download"]',
    'button:has-text("Download")',
    'a:has-text("Download")',
    'button:has-text("Free Download")',
    'a:has-text("Free Download")',
  ]

  for (const sel of clickables) {
    if (directUrl) break
    try {
      const el = await page.$(sel)
      if (el) {
        await el.click({ timeout: 3000 })
        await page.waitForTimeout(5000)
      }
    } catch {}
  }

  if (!directUrl) {
    try {
      // look for nice looking links in DOM
      const hrefs = await page.$$eval('a[href]', (as) =>
        as.map((a) => a.getAttribute('href') || '')
      )

      const guess = hrefs.find((h) => {
        const x = h.toLowerCase()
        return (
          x.includes('download') ||
          x.includes('.zip') ||
          x.includes('.rar') ||
          x.includes('.7z') ||
          x.includes('.mp4') ||
          x.includes('.mkv') ||
          x.includes('.exe') ||
          x.includes('.dmg')
        )
      })

      if (guess) directUrl = new URL(guess, url).toString()
    } catch {}
  }

  await browser.close()

  if (!directUrl) {
    throw new Error('Browser fallback could not resolve real download url (JS locked)')
  }

  return directUrl
}

async function runCurlSmartDownload(opts: {
  url: string
  outputFile: string
  downloadPath: string
  headers: ReturnType<typeof getDefaultClientHeaders>
  maxRedirectSteps?: number
}) {
  await fs.mkdir(opts.downloadPath, { recursive: true })

  let currentUrl = opts.url
  const maxSteps = opts.maxRedirectSteps ?? 3

  for (let step = 0; step < maxSteps; step++) {
    const args = [...opts.headers.curlArgs, '-o', opts.outputFile, currentUrl]
    const res = await execCmd('curl', args)

    if (res.code !== 0) {
      throw new Error(`curl failed (code ${res.code}): ${res.err.slice(0, 500)}`)
    }

    const head = await readFirstBytes(opts.outputFile, 8000)
    if (!head) return

    // got real file
    if (!looksLikeHtml(head)) return

    // try extracting direct redirect from HTML
    const redirect = extractRedirectUrlFromHtml(head)
    if (redirect) {
      try {
        currentUrl = new URL(redirect, currentUrl).toString()
      } catch {
        currentUrl = redirect
      }
      continue
    }

    // no redirect? it's a JS locked page, use headless browser
    const real = await resolveWithBrowser(currentUrl)
    currentUrl = real
  }

  throw new Error('Too many redirect steps while using curl smart download')
}

async function processDownload(job: Job<DownloadJobData>) {
  const { downloadId, tokenId, inputUrl, filename, downloadPath } = job.data

  console.log(`Processing download ${downloadId}`)

  const db = await getDb()
  const redis = await getRedisClient()

  try {
    await db.collection<Download>('downloads').updateOne(
      { _id: new ObjectId(downloadId) },
      {
        $set: {
          status: 'downloading',
          updatedAt: new Date(),
        },
      }
    )

    await fs.mkdir(downloadPath, { recursive: true })

    const outputFile = path.join(downloadPath, filename)
    const isTorrent = isTorrentUrl(inputUrl)

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
    const headers = getDefaultClientHeaders()

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
          ...headers.ariaArgs,
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

    let shouldFallbackCurl = false
    let lastHttpStatus: number | null = null

    aria2c.stdout.on('data', async (data) => {
      const output = data.toString()
      console.log(`aria2c stdout: ${output}`)

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

      const statusMatch = output.match(/status=(\d{3})/)
      if (statusMatch) {
        lastHttpStatus = parseInt(statusMatch[1])
        if (shouldFallbackOnHttpStatus(lastHttpStatus)) shouldFallbackCurl = true
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
      } else if (sizeMatch) {
        totalBytes = parseSizeToBytes(sizeMatch[1])
      }

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

        await redis.setEx(
          `download:progress:${downloadId}`,
          300,
          JSON.stringify(progress)
        )

        lastRedisUpdate = now
      }

      if (now - lastMongoUpdate >= 5000) {
        const eta = speed > 0 ? (totalBytes - downloadedBytes) / speed : 0

        const updateData: any = {
          totalBytes,
          downloadedBytes,
          speed,
          eta,
          updatedAt: new Date(),
        }

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
        if (shouldFallbackOnHttpStatus(lastHttpStatus)) shouldFallbackCurl = true
      }
    })

    const exitCode = await new Promise<number>((resolve) => {
      aria2c.on('close', (code) => resolve(code || 0))
    })

    if (!isTorrent && (shouldFallbackCurl || shouldFallbackOnHttpStatus(lastHttpStatus))) {
      console.log(`aria2 blocked status=${lastHttpStatus}, using curl smart download...`)

      await runCurlSmartDownload({
        url: finalUrl,
        outputFile,
        downloadPath,
        headers,
        maxRedirectSteps: 4,
      })
    } else if (exitCode !== 0) {
      throw new Error(`aria2c exited with code ${exitCode}`)
    }

    const files = await fs.readdir(downloadPath)

    const downloadedFile =
      files.find((f) => {
        if (f === '.aria2') return false
        if (f.endsWith('.aria2')) return false
        if (f === path.basename(downloadPath)) return false
        return true
      }) || filename

    const finalOutputFile = path.join(downloadPath, downloadedFile)
    const stats = await fs.stat(finalOutputFile)
    const finalSize = stats.size

    const head = await readFirstBytes(finalOutputFile, 5000)
    if (head && looksLikeHtml(head)) {
      throw new Error('Downloaded content is HTML/blocked page, not the actual file.')
    }

    const publicUrl = `${APP_URL}/d/${path.basename(
      path.dirname(downloadPath)
    )}/${downloadId}/${downloadedFile}`

    const updateData: any = {
      status: 'completed',
      filename: downloadedFile,
      totalBytes: finalSize,
      downloadedBytes: finalSize,
      publicUrl,
      completedAt: new Date(),
      updatedAt: new Date(),
    }

    if (redirectedUrl) updateData.redirectedUrl = redirectedUrl

    await db.collection<Download>('downloads').updateOne(
      { _id: new ObjectId(downloadId) },
      { $set: updateData }
    )

    await db.collection('tokens').updateOne(
      { _id: new ObjectId(tokenId) },
      {
        $inc: { usedBytes: finalSize },
        $set: { updatedAt: new Date() },
      }
    )

    await redis.del(`download:progress:${downloadId}`)

    console.log(`Download ${downloadId} completed successfully`)
  } catch (error: any) {
    console.error(`Download ${downloadId} failed:`, error)

    await db.collection<Download>('downloads').updateOne(
      { _id: new ObjectId(downloadId) },
      {
        $set: {
          status: 'failed',
          errorMessage: error.message,
          updatedAt: new Date(),
        },
      }
    )

    await redis.del(`download:progress:${downloadId}`)

    throw error
  }
}

const worker = new Worker<DownloadJobData>('downloads', processDownload, {
  connection,
  concurrency: 3,
  limiter: {
    max: 10,
    duration: 1000,
  },
})

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err)
})

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
