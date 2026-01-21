# Token Download Manager

Production-ready high-speed download manager with token-based access control, built with Next.js 14, MongoDB, Redis, and BullMQ.

## Features

- 🔐 **Secure Token-Based Access**: Admin creates tokens with custom limits
- 🚀 **High-Speed Downloads**: Multi-connection downloads using aria2c (16 connections)
- 📊 **Real-Time Progress**: Live download progress tracking via Redis
- 💾 **Persistent Storage**: MongoDB for data, Redis for caching and job queue
- 🔄 **Background Processing**: BullMQ worker for concurrent downloads
- 📦 **Direct File Serving**: Nginx serves downloaded files with Range request support
- 🔒 **SSL/TLS**: Automated Let's Encrypt SSL certificate management

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, NextAuth.js
- **Database**: MongoDB
- **Cache/Queue**: Redis, BullMQ
- **Download Engine**: aria2c
- **Web Server**: Nginx
- **Containerization**: Docker, Docker Compose

## Prerequisites

- Docker and Docker Compose
- Domain name pointed to your server (faster.p.dishis.tech)
- Ports 80 and 443 open

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd token-download-manager
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file:

```env
NEXT_PUBLIC_APP_URL=https://faster.p.dishis.tech
NEXTAUTH_URL=https://faster.p.dishis.tech
NEXTAUTH_SECRET=your-secure-random-string-min-32-chars

MONGODB_URI=mongodb://mongo:27017/token-download-manager

REDIS_HOST=redis
REDIS_PORT=6379

INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=SecurePassword123!

DOWNLOADS_DIR=/downloads
```

### 3. Get SSL Certificate

First, ensure your domain points to your server, then get the SSL certificate:

```bash
# Create docker network and volumes
docker network create app-network
docker volume create certbot-etc
docker volume create certbot-var

# Run certbot in standalone mode
docker run -it --rm \
  -p 80:80 \
  -v certbot-etc:/etc/letsencrypt \
  -v certbot-var:/var/lib/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  --email admin@faster.p.dishis.tech \
  --agree-tos \
  --no-eff-email \
  -d faster.p.dishis.tech
```

### 4. Build and Start Services

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Wait for services to be ready (about 30 seconds)
```

### 5. Initialize Admin User

```bash
docker-compose exec app npm run init-admin
```

### 6. Access the Application

Open your browser and navigate to:
```
https://faster.p.dishis.tech
```

Login with your admin credentials from the `.env` file.

## Usage

### Admin Workflow

1. **Login**: Navigate to `/admin/login`
2. **Create Token**: 
   - Go to "Tokens" page
   - Click "Create Token"
   - Set password, quotas, and limits
   - Copy the token link
3. **Share Token**: Give users the token link with password

Token link format:
```
https://faster.p.ishis.tech/t/<TOKEN>?p=<PASSWORD>
```

### User Workflow

1. **Access Token Portal**: Open the token link (with password in URL)
2. **Submit Download URL**: Enter a direct download URL
3. **Monitor Progress**: Watch real-time download progress
4. **Download File**: Once complete, click "Download File" button

## Architecture

### Services

- **app**: Next.js application (UI + API)
- **worker**: BullMQ worker for download processing
- **nginx**: Reverse proxy and file server
- **mongo**: MongoDB database
- **redis**: Redis cache and job queue
- **certbot**: SSL certificate management

### Download Flow

1. User submits URL via token portal
2. API validates token, URL, and quotas
3. Download job enqueued in BullMQ
4. Worker picks up job and starts aria2c
5. Progress updated to Redis (1s) and MongoDB (5s)
6. On completion, file accessible via Nginx
7. Token quota updated

### File Structure

```
/downloads/
  /<token>/
    /<downloadId>/
      <filename>
```

Public URL: `https://faster.p.dishis.tech/d/<token>/<downloadId>/<filename>`

## API Endpoints

### Admin APIs (Protected)

- `POST /api/admin/tokens` - Create new token
- `PATCH /api/admin/tokens/:id` - Update token status

### Public APIs

- `POST /api/downloads` - Start new download
- `GET /api/downloads?token=<TOKEN>` - Get downloads for token

## Monitoring

Access admin dashboard at `/admin/dashboard` to view:
- Active downloads count
- Total downloads count
- Redis connection health
- MongoDB connection health

## Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f worker
docker-compose logs -f nginx
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart worker
```

### Backup Database

```bash
# Backup MongoDB
docker-compose exec mongo mongodump --out /tmp/backup
docker cp $(docker-compose ps -q mongo):/tmp/backup ./backup

# Backup downloads
docker run --rm -v token-download-manager_downloads:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/downloads-backup.tar.gz /data
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d
```

## Security Features

- ✅ Password hashing with bcrypt
- ✅ SSRF protection (blocks private IPs)
- ✅ Token-based access control
- ✅ Rate limiting on downloads
- ✅ Quota enforcement
- ✅ SSL/TLS encryption
- ✅ Secure session management

## Performance

- **Download Speed**: Full VM bandwidth with 16 concurrent connections
- **Concurrent Downloads**: Configurable per token
- **Worker Concurrency**: 3 simultaneous downloads processing
- **Progress Updates**: Real-time via Redis
- **File Serving**: Optimized Nginx with sendfile and Range requests

## Troubleshooting

### SSL Certificate Issues

```bash
# Check certificate
docker run --rm -v certbot-etc:/etc/letsencrypt certbot/certbot certificates

# Renew manually
docker-compose exec certbot certbot renew
docker-compose restart nginx
```

### MongoDB Connection Issues

```bash
# Check MongoDB
docker-compose exec mongo mongosh --eval "db.adminCommand('ping')"
```

### Redis Connection Issues

```bash
# Check Redis
docker-compose exec redis redis-cli ping
```

### Worker Not Processing

```bash
# Check worker logs
docker-compose logs -f worker

# Restart worker
docker-compose restart worker
```

### Downloads Stuck

```bash
# Check BullMQ jobs
docker-compose exec redis redis-cli KEYS "bull:downloads:*"

# Clear failed jobs
docker-compose exec app node -e "
const { Queue } = require('bullmq');
const queue = new Queue('downloads', {
  connection: { host: 'redis', port: 6379 }
});
queue.obliterate({ force: true });
"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Public application URL | - |
| `NEXTAUTH_URL` | NextAuth base URL | - |
| `NEXTAUTH_SECRET` | NextAuth secret (32+ chars) | - |
| `MONGODB_URI` | MongoDB connection string | - |
| `REDIS_HOST` | Redis hostname | redis |
| `REDIS_PORT` | Redis port | 6379 |
| `INITIAL_ADMIN_EMAIL` | Initial admin email | - |
| `INITIAL_ADMIN_PASSWORD` | Initial admin password | - |
| `DOWNLOADS_DIR` | Download storage directory | /downloads |

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
