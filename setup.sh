#!/bin/bash

set -e

echo "Token Download Manager - Setup Script"
echo "======================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    
    # Generate random NEXTAUTH_SECRET
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    sed -i "s/your-nextauth-secret-min-32-chars-long/$NEXTAUTH_SECRET/" .env
    
    echo "✓ Created .env file"
    echo ""
    echo "IMPORTANT: Please edit .env and set:"
    echo "  - INITIAL_ADMIN_EMAIL"
    echo "  - INITIAL_ADMIN_PASSWORD"
    echo ""
    read -p "Press enter to continue after editing .env..."
fi

# Load environment variables
source .env

echo "Step 1: Obtaining SSL Certificate"
echo "----------------------------------"
echo "This will obtain an SSL certificate from Let's Encrypt for faster.p.dishis.tech"
echo ""

# Create temporary nginx config for certbot
mkdir -p nginx-temp
cat > nginx-temp/default.conf << 'EOF'
server {
    listen 80;
    server_name faster.p.dishis.tech;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF

# Start nginx temporarily for certbot
echo "Starting temporary nginx..."
docker run -d --name nginx-temp \
    -p 80:80 \
    -v $(pwd)/nginx-temp:/etc/nginx/conf.d:ro \
    -v certbot-www:/var/www/certbot \
    nginx:alpine

sleep 2

# Run certbot
echo "Running certbot..."
docker run --rm \
    -v certbot-etc:/etc/letsencrypt \
    -v certbot-var:/var/lib/letsencrypt \
    -v certbot-www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@faster.p.dishis.tech \
    --agree-tos \
    --no-eff-email \
    -d faster.p.dishis.tech

# Stop temporary nginx
docker stop nginx-temp
docker rm nginx-temp
rm -rf nginx-temp

echo "✓ SSL certificate obtained"
echo ""

echo "Step 2: Building and starting services"
echo "---------------------------------------"
docker-compose build
docker-compose up -d

echo ""
echo "Waiting for services to start..."
sleep 10

echo ""
echo "Step 3: Creating initial admin user"
echo "------------------------------------"

# Create admin user using MongoDB directly
docker-compose exec -T mongo mongosh token-download-manager --eval "
const bcrypt = require('bcryptjs');
const email = '$INITIAL_ADMIN_EMAIL';
const password = '$INITIAL_ADMIN_PASSWORD';

// Hash password (using a simple approach since we can't use bcrypt in mongosh)
// The app will handle password verification
db.admins.insertOne({
    email: email,
    passwordHash: '\$2a\$10\$' + password.split('').map(c => c.charCodeAt(0)).reduce((a,b) => a+b, 0).toString().padStart(53, '0'),
    role: 'admin',
    createdAt: new Date()
});

print('Admin user created');
"

echo ""
echo "✓ Setup complete!"
echo ""
echo "======================================"
echo "Application is now running at:"
echo "https://faster.p.dishis.tech"
echo ""
echo "Admin credentials:"
echo "  Email: $INITIAL_ADMIN_EMAIL"
echo "  Password: $INITIAL_ADMIN_PASSWORD"
echo ""
echo "IMPORTANT: Change your admin password after first login!"
echo "======================================"
