package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"server-player/internal/config"
	"server-player/internal/db/database"
	"server-player/internal/handlers"
	"server-player/internal/logger"
	"server-player/internal/middleware"
	"server-player/internal/services"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	logger.Init()

	log.Println("🚀 Starting Embed Player + Content Server")

	_ = godotenv.Load()
	config.Load()

	if err := database.Connect(); err != nil {
		log.Fatalf("❌ Failed to connect to MongoDB: %v", err)
	}
	defer database.Disconnect()
	log.Println("✅ MongoDB connected")

	port := config.AppConfig.Port
	if port == "" {
		port = "8081"
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go services.StartSettingSyncScheduler(ctx)

	if err := handlers.InitTemplates(); err != nil {
		log.Fatalf("❌ Failed to load templates: %v", err)
	}

	h := handlers.NewHandler(handlers.Handler{})

	mux := http.NewServeMux()

	mux.HandleFunc("/embed/", h.Embed)
	mux.HandleFunc("/playlist/", h.PlaylistJSON)
	mux.HandleFunc("/advert/", h.AdvertJSON)
	mux.HandleFunc("/favicon.ico", handlers.Favicon)

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"server-player"}`)
	})

	mux.HandleFunc("/", h.Home)

	server := &http.Server{
		Addr:    ":" + port,
		Handler: middleware.CORS(mux),
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("⏹️ Shutting down...")
		shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 5*time.Second)
		defer shutdownCancel()
		server.Shutdown(shutdownCtx)
	}()

	log.Printf("🌐 Server listening on http://localhost:%s", port)
	log.Printf("📍 Endpoints:")
	log.Printf("   GET /embed/{fileSlug}          - Video player embed page")
	log.Printf("   GET /playlist/{fileSlug}.json  - JW Player playlist feed")
	log.Printf("   GET /advert/{adSlug}.json      - Unified advert feed")
	log.Printf("   GET /health                    - Health check")
	log.Printf("   GET /{slug}.{ext}              - Proxy stream files")

	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("❌ Server error: %v", err)
	}

	log.Println("👋 Server stopped")
}
