# Token Download Manager

A production-grade, enterprise-ready download management system that leverages full VM bandwidth with multi-connection downloads, token-based access control, and comprehensive admin dashboard.

## Features

### User Features
- **Token-based Access**: Secure URLs with password protection
- **Multi-Connection Downloads**: Download with 16 simultaneous connections for maximum speed
- **Real-Time Progress**: Live speed, ETA, and progress tracking via Redis
- **Download History**: Track all downloads and their status
- **Quota Management**: Per-token download quotas and file size limits

### Admin Features
- **Token Management**: Create, revoke, pause tokens with flexible quotas
- **Download Monitoring**: Real-time view of all active downloads
- **System Metrics**: Live CPU, RAM, disk, and network usage
- **Security Monitoring**: IP tracking, suspicious activity alerts, IP blocking
- **Admin User Management**: Create and manage admin accounts
- **Audit Logs**: Complete activity logging for compliance

### Infrastructure
- **Docker Compose**: Complete containerized deployment
- **Nginx**: Reverse proxy with SSL/TLS, range requests for multi-connection downloads
- **Certbot**: Automatic Let's Encrypt certificate management
- **MongoDB**: Persistent data storage with full schema
- **Redis**: Fast caching, rate limiting, and job queues
- **BullMQ**: Distributed job processing for downloads
- **aria2c**: High-performance multi-connection download engine

## Tech Stack

- **Frontend**: Next.js 16+, React 19, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js App Router, Server Actions, API Routes
- **Database**: MongoDB
- **Cache/Queue**: Redis, BullMQ
- **Authentication**: NextAuth.js with credentials provider
- **Download Engine**: aria2c with segmented connections
- **Deployment**: Docker, Docker Compose, Nginx, Certbot

## Project Structure

```
├── app/
│   ├── admin/                    # Admin dashboard routes
│   │   ├── dashboard/
│   │   ├── tokens/
│   │   ├── downloads/
│   │   ├── users/
│   │   ├── security/
│   │   └── login/
│   ├── api/                      # API routes
│   │   ├── token/                # Token portal APIs
│   │   └── admin/                # Admin APIs
│   ├── t/[token]/               # Token portal page
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   └── globals.css              # Styling
├── components/
│   ├── admin/                   # Admin dashboard components
│   ├── token-portal/            # Token portal components
│   ├── ui/                      # shadcn/ui components
│   └── session-provider.tsx     # NextAuth provider
├── lib/
│   ├── db.ts                    # MongoDB connection
│   ├── redis.ts                 # Redis utilities
│   ├── queue.ts                 # BullMQ queue setup
│   ├── auth.ts                  # Authentication utilities
│   ├── auth-config.ts           # NextAuth configuration
│   ├── models.ts                # TypeScript data models
│   ├── download-executor.ts     # Download processing
│   ├── worker.ts                # Worker process
│   └── system-metrics.ts        # System monitoring
├── scripts/
│   ├── init-mongodb.ts          # MongoDB initialization
│   └── init-admin.ts            # Admin user setup
├── nginx/
│   └── nginx.conf               # Nginx configuration
├── Dockerfile                   # Main app container
├── Dockerfile.worker            # Worker container
├── docker-compose.yml           # Docker Compose setup
├── DEPLOYMENT.md                # Deployment guide
└── proxy.ts                     # Next.js middleware (auth)
```

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
nano .env  # Update with your configuration

# Run development server
npm run dev

# Initialize database (in another terminal)
npm run init-db
npm run init-admin
```

Visit `http://localhost:3000`

### Docker Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

```bash
# Quick start
cp .env.example .env
nano .env  # Update environment variables

# Build and start
docker-compose up -d

# Initialize database
docker exec tdm_app npm run init-db
docker exec tdm_app npm run init-admin
```

## API Endpoints

### Token Portal
- `POST /api/token/validate` - Validate token and password
- `POST /api/token/submit-download` - Submit download URL
- `GET /api/token/downloads` - Get token's downloads

### Admin Dashboard
- `GET /api/admin/metrics` - System metrics
- `GET /api/admin/activities` - Recent activity log

### Downloads
- `GET /d/<tokenId>/<downloadId>/<filename>` - Download file

## Data Models

### Token
- token (unique, secure random)
- passwordHash (bcrypt)
- maxFileSize, totalQuota
- expiryDate, status
- allowedIps, allowedDevices (optional)

### Download
- tokenId, inputUrl, originalFilename
- fileSize, downloadedBytes, status
- ip, userAgent, deviceId
- publicDownloadUrl, outputFilePath
- createdAt, updatedAt, completedAt

### Admin
- email (unique), passwordHash
- role (superadmin/admin)
- lastLogin, createdAt, disabled

## Security

- Bcrypt password hashing (all passwords)
- Token-based access control
- Rate limiting (5 login/min, 10 downloads/min per IP)
- SSRF prevention (URL validation)
- IP blocking capability
- Suspicious activity detection
- Audit logging
- TLS/SSL encryption
- HTTPS only for production

## Monitoring

### System Metrics
- CPU, RAM, Disk usage
- Network I/O
- Active downloads count
- Redis/MongoDB health

### Activity Tracking
- Download attempts and completion
- Admin actions
- Failed authentication attempts
- Suspicious activity patterns

## Scaling Considerations

- Horizontal scaling: Add multiple worker containers
- Database: MongoDB sharding for large datasets
- Cache: Redis persistence and clustering
- Storage: NFS or S3 for /downloads volume
- Load balancing: Multiple Nginx instances

## Development Notes

### Adding a New Admin Page

1. Create route in `/app/admin/<feature>/page.tsx`
2. Create component in `/components/admin/<feature>-management.tsx`
3. Create API route in `/app/api/admin/<feature>/route.ts`
4. Add navigation link in `/components/admin/admin-layout.tsx`

### Database Migrations

Database schema is initialized via `/scripts/init-mongodb.ts`. For schema changes:

1. Update models in `/lib/models.ts`
2. Update `/scripts/init-mongodb.ts` with new indexes
3. Run: `docker exec tdm_app npm run init-db`

### Adding New Features

- Use Server Components when possible
- Fetch data from database/cache, not in useEffect
- Implement proper error handling
- Add rate limiting where needed
- Log actions for audit trail

## Production Checklist

- [ ] Update all `.env` variables
- [ ] Generate strong `NEXTAUTH_SECRET`
- [ ] Configure domain and SSL
- [ ] Set admin credentials
- [ ] Review security settings in admin panel
- [ ] Test token creation and download flow
- [ ] Monitor system metrics
- [ ] Set up backups for MongoDB and downloads
- [ ] Configure firewall rules
- [ ] Test disaster recovery

## Troubleshooting

See [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section for common issues.

## Support

For production deployments, ensure:
- All services are running (check `docker-compose ps`)
- Database and Redis are healthy
- SSL certificates are valid
- Disk space is sufficient
- Monitor logs regularly

## License

This project is proprietary and confidential.
