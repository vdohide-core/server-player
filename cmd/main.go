package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"server-player/internal/config"
	"server-player/internal/db/database"
	"server-player/internal/handlers"
	"server-player/internal/logger"
	"server-player/internal/middleware"
	"server-player/internal/services"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	log.Println("🚀 Starting Embed Player + Content Server")

	// Load .env (optional)
	_ = godotenv.Load()

	// Load config
	config.Load()

	// Init file logger (writes to stdout + rotating log file)
	logCloser, err := logger.Init(config.AppConfig.LogPath)
	if err != nil {
		log.Printf("⚠️ File logging disabled: %v", err)
	} else {
		defer logCloser.Close()
		log.Printf("📝 Logging to: %s (max 25MB per file)", config.AppConfig.LogPath)
	}

	// Connect to MongoDB
	if err := database.Connect(); err != nil {
		log.Fatalf("❌ Failed to connect to MongoDB: %v", err)
	}
	defer database.Disconnect()
	log.Println("✅ MongoDB connected")

	// Get port from environment or use default
	port := config.AppConfig.Port
	if port == "" {
		port = "8081"
	}

	// Setup graceful shutdown context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start settings sync scheduler (sync immediately + every 1 minute)
	go services.StartSettingSyncScheduler(ctx)

	// Initialize templates
	if err := handlers.InitTemplates(); err != nil {
		log.Fatalf("❌ Failed to load templates: %v", err)
	}

	// Initialize handlers
	h := handlers.NewHandler(handlers.Handler{})

	// Setup HTTP routes
	mux := http.NewServeMux()

	// ─── Player Routes ─────────────────────────────────────────────────────

	// Route: /embed/{fileSlug} — Video player embed page
	mux.HandleFunc("/embed/", h.Embed)

	// Route: /vast/{domainSlug}.xml — VAST 3.0 ad tag by domain slug
	mux.HandleFunc("/vast/", h.Vast)

	// ─── Static file server from embedded FS ──────────────────────────────
	staticFS := handlers.GetStaticFS()
	fileServer := http.FileServer(staticFS)

	// ─── API Routes ────────────────────────────────────────────────────────

	// Route: /health — Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"server-player"}`)
	})

	// Route: /logs — Log list API
	mux.HandleFunc("/logs", h.HandleLogList)
	mux.HandleFunc("/logs/", h.HandleLogFile)

	// Route: catch-all — Content server (HLS, proxy, thumbnail) + static files
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Root path → 404
		if path == "/" {
			handlers.HandleNotFound(w, r)
			return
		}

		// Check if file exists in embedded static FS
		f, err := staticFS.Open(path)
		if err == nil {
			stat, _ := f.Stat()
			f.Close()
			if !stat.IsDir() {
				// Long-lived CDN cache for JS/CSS assets (1 month = 2592000s)
				ext := strings.ToLower(filepath.Ext(path))
				if ext == ".js" || ext == ".css" {
					w.Header().Set("Cache-Control", "no-store")
					w.Header().Set("CDN-Cache-Control", "max-age=2592000")
				}
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// Delegate to content server router
		h.Home(w, r)
	})

	// Create server
	server := &http.Server{
		Addr:    ":" + port,
		Handler: middleware.CORS(mux),
	}

	// Setup graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("⏹️ Shutting down...")
		shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 5*time.Second)
		defer shutdownCancel()
		server.Shutdown(shutdownCtx)
	}()

	// Start server
	log.Printf("🌐 Server listening on http://localhost:%s", port)
	log.Printf("📍 Endpoints:")
	log.Printf("   GET /embed/{fileSlug}          - Video player embed page")
	log.Printf("   GET /vast/{domainSlug}.xml      - VAST 3.0 ad tag")
	log.Printf("   GET /health                    - Health check")
	log.Printf("   GET /logs                      - Log file list")
	log.Printf("   GET /logs/{file}               - Log file reader")
	log.Printf("   GET /{slug}/playlist.m3u8      - HLS master playlist")
	log.Printf("   GET /{slug}/video.m3u8         - HLS video stream")
	log.Printf("   GET /thumb/{slug}/{t}.jpg      - Thumbnail poster")
	log.Printf("   GET /{slug}.{ext}              - Proxy stream files")

	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("❌ Server error: %v", err)
	}

	log.Println("👋 Server stopped")
}
