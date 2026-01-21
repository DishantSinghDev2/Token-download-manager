# Torrent Download Guide

## Overview

The Token Download Manager supports BitTorrent downloads including:
- Magnet links (`magnet:?xt=urn:btih:...`)
- `.torrent` files (direct URL to torrent file)

## Features

- ✅ Full BitTorrent protocol support via aria2c
- ✅ DHT (Distributed Hash Table) enabled
- ✅ PEX (Peer Exchange) enabled  
- ✅ LPD (Local Peer Discovery) enabled
- ✅ Real-time torrent statistics (seeders, peers, upload speed)
- ✅ Minimal upload (1KB/s) - download-focused
- ✅ No seeding after download completes
- ✅ Optimized for maximum download speed

## Port Configuration

**Required Ports for Maximum Speed:**

The following ports are exposed for BitTorrent traffic:

- **6881-6889 TCP**: BitTorrent peer connections
- **6881-6889 UDP**: DHT and tracker UDP traffic

**Firewall Setup:**

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=6881-6889/tcp
sudo firewall-cmd --permanent --add-port=6881-6889/udp
sudo firewall-cmd --reload

# iptables
sudo iptables -A INPUT -p tcp --dport 6881:6889 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 6881:6889 -j ACCEPT
```

**Cloud Provider Setup:**

- **AWS**: Add inbound rules in Security Group for ports 6881-6889 (TCP & UDP)
- **GCP**: Add firewall rule allowing TCP/UDP 6881-6889
- **Azure**: Add inbound security rule for ports 6881-6889
- **DigitalOcean**: Add inbound rules in Firewall for ports 6881-6889

## Usage

### 1. Magnet Link

Copy a magnet link and paste it in the download URL field:

```
magnet:?xt=urn:btih:ABC123...&dn=Ubuntu+22.04&tr=udp://tracker.example.com:6969
```

### 2. Torrent File URL

Paste direct URL to a `.torrent` file:

```
https://releases.ubuntu.com/22.04/ubuntu-22.04.3-desktop-amd64.iso.torrent
```

## Torrent Information Display

During download, the UI shows:

- **Seeders**: Number of complete copies available
- **Peers**: Number of partial copies downloading
- **Upload Speed**: Current upload rate (limited to 1KB/s)

## Performance Optimization

### aria2c Torrent Settings

The worker uses these optimized settings:

```bash
--enable-dht=true              # DHT for trackerless torrents
--bt-enable-lpd=true           # Local peer discovery
--enable-peer-exchange=true    # PEX for more peers
--bt-max-peers=100             # Max simultaneous peers
--bt-request-peer-speed-limit=10M  # Request fast peers
--max-upload-limit=1K          # Minimal upload (1KB/s)
--seed-time=0                  # Don't seed after completion
```

### Why Minimal Upload?

- **Focus on downloads**: Prioritizes download bandwidth
- **Quota conservation**: Doesn't waste bandwidth on uploads
- **Privacy**: Minimal participation in swarm
- **Legal**: Reduces copyright concerns

**Note**: Some trackers may require a minimum upload ratio. This setup prioritizes downloading.

## Torrent-Specific Features

### 1. Automatic File Detection

For multi-file torrents, the system automatically:
- Downloads all files in the torrent
- Detects the largest/main file
- Updates filename after metadata is received

### 2. Metadata Download

Magnet links download metadata first (1-2 seconds), then start the actual file download.

### 3. Progress Tracking

Real-time updates show:
- Download progress
- Current speed
- ETA
- Seeder/peer count
- Upload rate

## Common Issues

### Slow Torrent Speeds

**Possible causes:**
- Few seeders available
- Ports not open (6881-6889)
- ISP throttling BitTorrent traffic
- Firewall blocking connections

**Solutions:**
```bash
# Check if ports are open
nc -zv <your-server-ip> 6881
nc -zvu <your-server-ip> 6881

# View torrent connections
docker exec token-download-manager-worker-1 netstat -an | grep 6881

# Check worker logs
docker logs -f token-download-manager-worker-1
```

### Stalled Torrent

If a torrent stalls:
1. Check seeders count (0 seeders = no source)
2. Wait for more seeders to come online
3. Try a different torrent source

### Metadata Timeout

For magnet links, if metadata doesn't download:
- DHT may be blocked
- Magnet link may be invalid
- No peers available
- Try a different torrent

## Security Considerations

### Upload Limit

Upload is limited to 1KB/s because:
- Reduces exposure in BitTorrent swarm
- Conserves bandwidth for downloads
- Minimizes legal risks
- Focus on download performance

### Privacy

For better privacy:
- Use a VPN on your server
- Consider proxy settings in aria2c
- Monitor upload to ensure minimal sharing

### Legal

**Important**: Only download torrents you have legal right to access. This tool does not encourage piracy.

## Advanced Configuration

### Custom aria2c Options

To modify torrent settings, edit `src/worker/download-worker.ts`:

```typescript
// Increase upload if needed
'--max-upload-limit=100K',  // 100KB/s instead of 1KB/s

// More aggressive peer finding
'--bt-max-peers=200',

// Longer seed time (for private trackers)
'--seed-time=60',  // seed for 60 seconds
```

### Private Tracker Support

For private trackers that require authentication:

```bash
# Add cookies or authentication in download URL
# Or use a proxy that handles authentication
```

## Monitoring

### View Active Torrents

```bash
# Check worker logs
docker logs -f token-download-manager-worker-1 | grep -E 'SEEDER|PEER'

# Monitor network connections
docker exec token-download-manager-worker-1 ss -tunap | grep aria2c
```

### Check Port Status

```bash
# External port check
telnet <your-server-ip> 6881

# Internal check
docker exec token-download-manager-worker-1 netstat -ln | grep 6881
```

## Performance Metrics

Typical speeds:
- **Well-seeded torrents**: Up to line speed
- **Few seeders**: Varies greatly
- **Magnet links**: Slight delay for metadata

Factors affecting speed:
- Number of seeders
- Network bandwidth
- Port forwarding
- ISP throttling
- Torrent file size

## Best Practices

1. ✅ **Open required ports** (6881-6889)
2. ✅ **Check seeder count** before downloading
3. ✅ **Monitor quota usage** for large torrents
4. ✅ **Use magnet links** when possible (no .torrent file needed)
5. ✅ **Wait for metadata** with magnet links (1-2 seconds)
6. ⚠️ **Verify legality** of torrent content

## Troubleshooting Commands

```bash
# Test if BitTorrent ports are accessible
nc -zv faster.p.dishis.tech 6881

# Check aria2c is listening
docker exec token-download-manager-worker-1 netstat -ln | grep 6881

# View torrent progress in real-time
docker logs -f token-download-manager-worker-1

# Check DHT status
docker logs token-download-manager-worker-1 | grep DHT

# Monitor bandwidth
docker stats token-download-manager-worker-1
```

## FAQ

**Q: Can I seed after download?**
A: Currently set to not seed. Modify `--seed-time` in worker if needed.

**Q: Why is upload limited to 1KB/s?**
A: To focus bandwidth on downloads and minimize exposure in swarm.

**Q: Do I need a VPN?**
A: Recommended for privacy, especially for public torrents.

**Q: Can I download private tracker torrents?**
A: Yes, but you may need to configure authentication.

**Q: Why is my torrent slow?**
A: Check seeder count, port forwarding, and firewall settings.

**Q: Can I increase upload limit?**
A: Yes, edit `--max-upload-limit` in `download-worker.ts`.

---

## Summary

- **Ports**: 6881-6889 (TCP/UDP) must be open
- **Upload**: Limited to 1KB/s (configurable)
- **Seeding**: Disabled by default
- **DHT/PEX**: Fully enabled
- **Real-time stats**: Seeders, peers, upload speed displayed
- **Performance**: Optimized for maximum download speed

Open the required ports on your server/firewall for best performance!
