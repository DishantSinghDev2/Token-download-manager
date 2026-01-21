# Quick Start Guide

Get your Token Download Manager running in 5 minutes!

## Prerequisites

1. **Linux Server** with Docker and Docker Compose installed
2. **Domain**: `faster.p.dishis.tech` pointed to your server's IP
3. **Ports**: 80 and 443 open in firewall

## One-Command Deploy

```bash
# Clone the repository
git clone <repo-url> token-download-manager
cd token-download-manager

# Edit configuration
nano .env

# Set these values:
# INITIAL_ADMIN_EMAIL=your-email@example.com
# INITIAL_ADMIN_PASSWORD=YourSecurePassword123!

# Run deployment script
./deploy.sh
```

That's it! Your application will be running at `https://faster.p.dishis.tech`

## Manual Setup (if deploy.sh fails)

### 1. Create Environment File

```bash
cp .env.example .env
nano .env
```

Set these variables:
```env
INITIAL_ADMIN_EMAIL=admin@yourdomain.com
INITIAL_ADMIN_PASSWORD=SecurePassword123!
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

### 2. Get SSL Certificate

```bash
docker volume create token-download-manager_certbot-etc
docker volume create token-download-manager_certbot-var

docker run -it --rm \
  -p 80:80 \
  -v token-download-manager_certbot-etc:/etc/letsencrypt \
  -v token-download-manager_certbot-var:/var/lib/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  --email admin@faster.p.dishis.tech \
  --agree-tos \
  -d faster.p.dishis.tech
```

### 3. Start Services

```bash
docker-compose build
docker-compose up -d
```

### 4. Initialize Admin

```bash
# Wait 15 seconds for services to start
sleep 15

# Create admin user
docker-compose exec app npm run init-admin
```

### 5. Access Application

Open: `https://faster.p.dishis.tech/admin/login`

## First Steps After Login

1. **Login**: Use your admin credentials
2. **Create Token**: 
   - Go to "Tokens" page
   - Click "Create Token"
   - Fill in the form:
     - Password: e.g., `user123pass`
     - Max File Size: e.g., `10` GB
     - Total Quota: e.g., `100` GB
     - Expiry: e.g., `30` days
     - Max Concurrent: e.g., `5`
3. **Copy Link**: Click "Copy Link" button
4. **Test**: Open link in incognito window

## Example Token Link

```
https://faster.p.dishis.tech/t/abc123def456...?p=user123pass
```

Users can:
- Paste download URLs
- Monitor progress in real-time
- Download completed files

## Common Issues

### SSL Certificate Failed
- Check domain DNS: `dig faster.p.dishis.tech`
- Ensure port 80 is open: `nc -zv <your-ip> 80`
- Check firewall rules

### Services Not Starting
```bash
# Check logs
docker-compose logs -f

# Restart services
docker-compose restart
```

### Can't Login
```bash
# Recreate admin
docker-compose exec app npm run init-admin
```

## Useful Commands

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f worker

# Restart everything
docker-compose restart

# Stop everything
docker-compose down

# Update application
git pull
docker-compose up -d --build
```

## Architecture Overview

```
User Request → Nginx (SSL) → Next.js App → MongoDB/Redis
                      ↓
              Downloaded Files ← BullMQ Worker ← aria2c
```

## Performance

- **Download Speed**: Full server bandwidth
- **Connections**: 16 per download (aria2c)
- **Concurrent**: 3 downloads processing simultaneously
- **Updates**: Real-time progress every second

## Security

✅ SSL/TLS encryption
✅ Token-based access  
✅ Password protection
✅ SSRF protection (blocks private IPs)
✅ Rate limiting
✅ Quota enforcement

## Support

- Full README: `README.md`
- Issues: GitHub Issues
- Logs: `docker-compose logs -f`

---

**Ready to scale?** Your download manager is production-ready and can handle multiple concurrent users with high-speed downloads!
