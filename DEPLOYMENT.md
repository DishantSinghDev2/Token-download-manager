# Token Download Manager - Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- A Linux VM with sufficient disk space for downloads
- Domain name pointing to your VM IP
- Static IP for your VM

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repo-url>
cd token-download-manager

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Configure Environment Variables

Edit `.env` and set:
- `DOMAIN`: Your domain (e.g., faster.p.dishis.tech)
- `NEXTAUTH_SECRET`: Generate with `openssl rand -hex 32`
- `CERTBOT_EMAIL`: Email for Let's Encrypt notifications
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: Initial admin credentials

### 3. Initialize Database

```bash
# Build and start services
docker compose up -d

# Wait for services to be ready
sleep 10

# Initialize MongoDB
docker exec tdm_app npm run init-db

# Create initial admin user (optional - or use API)
docker exec tdm_app node -e "require('./scripts/init-admin.js')"
```

### 4. Setup SSL Certificate

```bash
# Generate initial certificate
docker exec tdm_certbot certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d faster.p.dishis.tech \
  --email admin@faster.p.dishis.tech \
  --agree-tos \
  --non-interactive

# Or for DNS challenge (recommended for production)
# Edit docker-compose.yml to use DNS challenge
```

### 5. Start Services

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Verify all services are healthy
docker-compose ps
```

## Architecture

### Services

- **app (Next.js)**: Main web application on port 3000
- **worker (BullMQ)**: Background download processor
- **nginx**: Reverse proxy, SSL termination, static file serving on ports 80/443
- **mongo**: MongoDB database on port 27017
- **redis**: Redis cache/queue on port 6379
- **certbot**: Let's Encrypt certificate management

### Volumes

- `/downloads`: Shared volume for completed downloads (accessible via Nginx)
- `mongo_data`: MongoDB persistent data
- `redis_data`: Redis persistent data
- `certbot_*`: SSL certificate storage

## Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f worker
docker-compose logs -f nginx
```

### Access Admin Dashboard

1. Open `https://faster.p.dishis.tech/admin/login`
2. Login with credentials from `.env`
3. Manage tokens, view downloads, monitor system

### Create New Token

```bash
# Via API
curl -X POST https://faster.p.dishis.tech/api/admin/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxFileSize": 10737418240,
    "totalQuota": 53687091200,
    "expiryDate": "2025-12-31T23:59:59Z",
    "allowedMaxConcurrentDownloads": 2,
    "password": "your-token-password"
  }'
```

### Monitor Downloads

```bash
# Check active downloads
docker exec tdm_app curl http://localhost:3000/api/admin/downloads

# View worker logs
docker-compose logs worker

# Check Redis queue
docker exec tdm_redis redis-cli KEYS "*"
```

## Security Best Practices

1. **Change Default Credentials**
   - Update `ADMIN_PASSWORD` in `.env`
   - Use strong passwords (16+ characters)

2. **Firewall Rules**
   ```bash
   # Only allow HTTPS from internet
   sudo ufw allow 443/tcp
   sudo ufw allow 80/tcp  # For Certbot renewal
   sudo ufw enable
   ```

3. **Rate Limiting**
   - Configured in nginx.conf
   - 5 login attempts per minute per IP
   - 10 download submissions per minute per IP

4. **IP Blocking**
   - Automatic blocking of suspicious IPs via Redis
   - Manual IP blocking available in admin panel
   - Check `/admin/security` for blocked IPs

5. **SSL/TLS**
   - Automatic renewal via Certbot
   - TLS 1.2+ enforced
   - Strong ciphers configured

## Troubleshooting

### Certificate Renewal Issues

```bash
# Manual renewal
docker exec tdm_certbot certbot renew --force-renewal

# Check certificate status
docker exec tdm_certbot certbot certificates
```

### Database Connection Issues

```bash
# Check MongoDB
docker exec tdm_mongo mongosh --eval "db.admin().ping()"

# Check Redis
docker exec tdm_redis redis-cli ping
```

### Downloads Not Processing

```bash
# Check worker status
docker-compose logs worker

# Restart worker
docker-compose restart worker

# Check Redis queue
docker exec tdm_redis redis-cli KEYS "bull:downloads*"
```

### High Disk Usage

```bash
# Check downloads folder
du -sh /downloads/*

# View downloads in DB
docker exec tdm_app node -e "
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  client.connect().then(async () => {
    const db = client.db('token_download_manager');
    const downloads = await db.collection('downloads').find().toArray();
    console.log(downloads);
  });
"

# Clean old completed downloads
docker-compose exec app node -e "
  const { getDb } = require('./lib/db');
  const cutoff = new Date(Date.now() - 7*24*60*60*1000); // 7 days ago
  (async () => {
    const db = await getDb();
    const result = await db.collection('downloads').deleteMany({
      status: 'completed',
      completedAt: { \$lt: cutoff }
    });
    console.log('Deleted', result.deletedCount, 'old downloads');
  })();
"
```

## Backup and Restore

### Backup

```bash
# Backup MongoDB
docker exec tdm_mongo mongodump --out /backup

# Backup Redis
docker exec tdm_redis redis-cli BGSAVE

# Backup files
tar -czf downloads_backup.tar.gz /downloads/
```

### Restore

```bash
# Restore MongoDB
docker exec tdm_mongo mongorestore /backup

# Restore Redis
docker cp redis_dump.rdb tdm_redis:/data/
docker exec tdm_redis redis-cli SHUTDOWN
docker-compose restart redis

# Restore files
tar -xzf downloads_backup.tar.gz
```

## Scaling

### Increase Worker Concurrency

Edit `docker-compose.yml`:
```yaml
worker:
  environment:
    WORKER_CONCURRENCY: "10"  # Increase from 3
```

Then restart: `docker-compose restart worker`

### Multiple Workers

Add additional worker services in `docker-compose.yml`:
```yaml
  worker-2:
    build: ... # same as worker
    environment:
      WORKER_CONCURRENCY: "5"
```

### Database Performance

```bash
# Add indexes (already created in init)
docker exec tdm_app npm run db:init-indexes

# Monitor MongoDB
docker exec tdm_mongo mongosh --eval "
  db.setProfilingLevel(1, { slowms: 100 });
  db.system.profile.find().limit(5).sort({ ts: -1 }).pretty();
"
```

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Verify .env configuration
3. Ensure all services are healthy: `docker-compose ps`
4. Check disk space: `df -h`
5. Review security logs in admin panel
