#!/bin/bash

set -e

echo "=========================================="
echo "Token Download Manager - Quick Deploy"
echo "=========================================="
echo ""

# Check if domain is accessible
echo "Checking domain accessibility..."
if ! host faster.p.dishis.tech > /dev/null 2>&1; then
    echo "❌ ERROR: Domain faster.p.dishis.tech does not resolve"
    echo "Please ensure:"
    echo "  1. Domain DNS is properly configured"
    echo "  2. Domain points to this server's IP"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    
    # Generate random NEXTAUTH_SECRET
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    sed -i "s/your-nextauth-secret-min-32-chars-long/$NEXTAUTH_SECRET/" .env
    
    echo "✓ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and set:"
    echo "  - INITIAL_ADMIN_EMAIL (your admin email)"
    echo "  - INITIAL_ADMIN_PASSWORD (secure password)"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# Load environment
source .env

if [ -z "$INITIAL_ADMIN_EMAIL" ] || [ "$INITIAL_ADMIN_EMAIL" = "admin@example.com" ]; then
    echo "❌ ERROR: Please set INITIAL_ADMIN_EMAIL in .env"
    exit 1
fi

if [ -z "$INITIAL_ADMIN_PASSWORD" ] || [ "$INITIAL_ADMIN_PASSWORD" = "changeme123" ]; then
    echo "❌ ERROR: Please set INITIAL_ADMIN_PASSWORD in .env"
    exit 1
fi

echo ""
echo "Step 1: Obtaining SSL Certificate"
echo "======================================"

# Check if certificate already exists
if docker run --rm -v token-download-manager_certbot-etc:/etc/letsencrypt certbot/certbot certificates 2>/dev/null | grep -q "faster.p.dishis.tech"; then
    echo "✓ SSL certificate already exists"
else
    echo "Obtaining SSL certificate from Let's Encrypt..."
    echo ""
    
    # Stop any service on port 80
    if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port 80 is in use. Stopping conflicting services..."
        docker compose down 2>/dev/null || true
    fi
    
    # Create volumes if they don't exist
    docker volume create token-download-manager_certbot-etc 2>/dev/null || true
    docker volume create token-download-manager_certbot-var 2>/dev/null || true
    
    # Get certificate
    docker run -it --rm \
        -p 80:80 \
        -v token-download-manager_certbot-etc:/etc/letsencrypt \
        -v token-download-manager_certbot-var:/var/lib/letsencrypt \
        certbot/certbot certonly \
        --standalone \
        --email admin@faster.p.dishis.tech \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d faster.p.dishis.tech
    
    if [ $? -eq 0 ]; then
        echo "✓ SSL certificate obtained successfully"
    else
        echo "❌ ERROR: Failed to obtain SSL certificate"
        echo "Common issues:"
        echo "  - Domain not pointing to this server"
        echo "  - Port 80 not accessible from internet"
        echo "  - Firewall blocking connections"
        exit 1
    fi
fi

echo ""
echo "Step 2: Building Docker Images"
echo "======================================"
docker compose build --no-cache

echo ""
echo "Step 3: Starting Services"
echo "======================================"
docker compose up -d

echo ""
echo "Waiting for services to start..."
sleep 15

# Wait for MongoDB to be ready
echo "Waiting for MongoDB..."
until docker compose exec -T mongo mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    sleep 2
done
echo "✓ MongoDB is ready"

# Wait for Redis to be ready
echo "Waiting for Redis..."
until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    sleep 2
done
echo "✓ Redis is ready"

echo ""
echo "Step 4: Initializing Admin User"
echo "======================================"

# Wait a bit more for app to be ready
sleep 5

# Run init-admin script
docker compose exec -T app node src/scripts/init-admin.js

if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Admin initialization failed"
    echo "You can manually create admin later with:"
    echo "  docker-compose exec app node src/scripts/init-admin.js"
fi


echo ""
echo "=========================================="
echo "✓ Deployment Complete!"
echo "=========================================="
echo ""
echo "Application is now running at:"
echo "  🌐 https://faster.p.dishis.tech"
echo ""
echo "Admin Login:"
echo "  📧 Email: $INITIAL_ADMIN_EMAIL"
echo "  🔑 Password: $INITIAL_ADMIN_PASSWORD"
echo ""
echo "Next Steps:"
echo "  1. Visit https://faster.p.dishis.tech/admin/login"
echo "  2. Login with your admin credentials"
echo "  3. Create your first download token"
echo "  4. Share the token link with users"
echo ""
echo "Useful Commands:"
echo "  View logs:     docker compose logs -f"
echo "  Restart:       docker compose restart"
echo "  Stop:          docker compose down"
echo "  Update:        git pull && docker compose up -d --build"
echo ""
echo "⚠️  IMPORTANT: Change your admin password after first login!"
echo "=========================================="
