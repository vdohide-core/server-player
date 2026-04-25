# server-player

Embed player + content delivery server for vdohide-core.  
Serves the video embed page (`/embed/{slug}`), VAST ad tags, HLS streams, images, sprites, and thumbnails from storage nodes.

---

## Features

### Player
- Embed player page (`/embed/{slug}`) with domain-aware configuration
- VAST 3.0 ad tag endpoint (`/vast.xml`)
- Space-based access control — domain scoped to a `spaceId`
- Plan-aware ad resolution: `free` plan → global ads, `paid` plan → domain ads
- Maintenance mode via `player_maintenance` setting
- Processing status page: queue / processing (with %) / error states

### Content Delivery
- HLS master playlist (`/{slug}/playlist.m3u8`)
- HLS segment playlist (`/{mediaSlug}/video.m3u8`) with CDN domain rewriting
- Image proxy with on-the-fly resize (`?w=400&h=300&fit=cover&q=80`)
- Sprite sheet + VTT proxy (`/{slug}/sprite/sprite.vtt`, `/{slug}/sprite/{n}.jpg`)
- Thumbnail poster proxy (`/thumb/{slug}/{n}.jpg`)
- Image not-found PNG placeholder

### Infrastructure
- Settings sync every 1 minute from MongoDB → `conf/setting.json`
- Domain cache sync → `conf/domains.json`
- Space cache sync → `conf/spaces.json`
- Rotating log file (25 MB per file, startup rotation)
- Log reader API (`GET /logs`, `GET /logs/{filename}?tail=200`)

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8083` | HTTP listen port |
| `MONGODB_URI` | _(required)_ | MongoDB connection string |
| `LOG_PATH` | `logs/server-content.log` | Log file path |

---

## Settings (MongoDB `settings` collection)

| Name | Type | Description |
|---|---|---|
| `player_maintenance` | `boolean` | Enable maintenance mode (`false` = normal) |
| `advert_vdo` | `array` | Global video ad list (free plan VAST) |
| `advert_image` | `object` | Global image overlay ad (free plan) |
| `advert_javascript` | `string` | Global JS ad code (free plan) |

### `advert_vdo` item shape
```json
{
  "id": "abc",
  "name": "Ad Name",
  "mp4Url": "https://...",
  "websiteUrl": "https://...",
  "skipSeconds": 5,
  "isActive": true
}
```

### `advert_image` shape
```json
{
  "isActive": true,
  "imageUrl": "https://...",
  "websiteUrl": "https://...",
  "showOn": ["ready", "end", "pause"]
}
```

### `advert_javascript`
Plain HTML string (script tag).

---

## Ad Resolution Logic

| Space Plan | Video Ads | Image Ad | JS Ad |
|---|---|---|---|
| `free` (default) | VAST always enabled → `/vast.xml` | from `advert_image` setting | from `advert_javascript` setting |
| `paid` | from `CustomDomain.Advert[]` | from `CustomDomain.AdvertImage` | from `CustomDomain.AdvertJavascript` |

---

## Cache Headers

| Response | Cache-Control | CDN-Cache-Control |
|---|---|---|
| Embed player | `no-store` | `max-age=14400` (4h) |
| Maintenance / Error / Processing | `no-store` | `max-age=60` (1m) |
| JS / CSS static files | `no-store` | `max-age=2592000` (30d) |

---

## API Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/embed/{slug}` | Video embed player page |
| `GET` | `/vast.xml` | VAST 3.0 ad tag |
| `GET` | `/health` | Health check |
| `GET` | `/{slug}/playlist.m3u8` | HLS master playlist |
| `GET` | `/{mediaSlug}/video.m3u8` | HLS segment playlist |
| `GET` | `/{slug}/sprite/sprite.vtt` | Sprite VTT |
| `GET` | `/{slug}/sprite/{n}.jpg` | Sprite image |
| `GET` | `/thumb/{slug}/{n}.jpg` | Thumbnail poster |
| `GET` | `/{slug}.{ext}` | File stream / image proxy |
| `GET` | `/logs` | List log files |
| `GET` | `/logs/{filename}?tail=200` | Read log file (newest first) |

---

## Install

### All domains (catch-all — recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/vdohide-core/server-player/main/install.sh | sudo -E bash -s -- \
    --port 8083 \
    --mongodb-uri "mongodb+srv://user:pass@host/platform"
```

### Specific domains only

```bash
curl -fsSL https://raw.githubusercontent.com/vdohide-core/server-player/main/install.sh | sudo -E bash -s -- \
    --port 8083 \
    --domain embed.vdohide.com cdn.vdohide.com \
    --mongodb-uri "mongodb+srv://user:pass@host/platform"
```

### App only (no Nginx)

```bash
curl -fsSL https://raw.githubusercontent.com/vdohide-core/server-player/main/install.sh | sudo -E bash -s -- \
    --app \
    --port 8083 \
    --mongodb-uri "mongodb+srv://user:pass@host/platform"
```

### Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/vdohide-core/server-player/main/install.sh | sudo bash -s -- --uninstall
```

---

## Service Management

```bash
systemctl status  server-player
systemctl restart server-player
systemctl stop    server-player
journalctl -u server-player -f
```

---

## Release

```bash
git tag v1.0.0
git push origin v1.0.0
```
