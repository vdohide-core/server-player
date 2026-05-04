package handlers

import (
	"embed"
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"strconv"
	"strings"

	"server-player/internal/assets"
	"server-player/internal/services"
)

//go:embed templates/*.html
var templatesFS embed.FS

//go:embed static
var staticEmbedFS embed.FS

var templates *template.Template

// Handler holds dependencies for HTTP handlers
type Handler struct{}

// NewHandler creates a new Handler instance
func NewHandler(h Handler) *Handler {
	return &h
}

// InitTemplates loads HTML templates from embedded FS
func InitTemplates() error {
	var err error
	templates, err = template.ParseFS(templatesFS, "templates/*.html")
	if err != nil {
		return err
	}
	log.Printf("✅ Templates loaded from embedded filesystem")
	return nil
}

// GetStaticFS returns the HTTP file system for static files, rooted at "static"
func GetStaticFS() http.FileSystem {
	fsys, err := fs.Sub(staticEmbedFS, "static")
	if err != nil {
		panic(err)
	}
	return http.FS(fsys)
}

// ─── Domain/Space Validation ──────────────────────────────────────────────────

// CheckDomainSpace validates if the request domain allows accessing the target space.
func CheckDomainSpace(r *http.Request, targetSpaceID *string) bool {
	domain, isDomainRequest := services.FindDomain(r.Host)
	if isDomainRequest {
		if domain == nil || domain.Status != "active" || !domain.Enable {
			return false
		}

		hasSpace := domain.SpaceID != nil && *domain.SpaceID != ""
		hasCreator := domain.CreatorID != nil && *domain.CreatorID != ""

		// System domain (no SpaceID and no CreatorID) can fetch any file
		if !hasSpace && !hasCreator {
			return true
		}

		// Workspace domain (has SpaceID)
		if hasSpace {
			tSpace := ""
			if targetSpaceID != nil {
				tSpace = *targetSpaceID
			}
			if tSpace != *domain.SpaceID {
				return false
			}
			return true
		}

		// Legacy user domain (has CreatorID but no SpaceID)
		// We reject it because we can't verify CreatorID across all handlers (like video.go uses Media)
		// and we are enforcing the new Workspace-based system.
		return false
	}
	return true
}

// ─── Not-Found Helpers ────────────────────────────────────────────────────────

// notFoundImage200 holds the pre-resized 200x200 not-found placeholder image
var notFoundImage200 []byte

func init() {
	params := &ImageParams{Width: 200, Height: 200, Fit: "cover", Quality: 80}
	resized, _, err := resizeImage(assets.NotFoundImage, "image/png", params)
	if err != nil {
		notFoundImage200 = assets.NotFoundImage
	} else {
		notFoundImage200 = resized
	}
}

// imageNotFound sends the 200x200 "not found" placeholder PNG
func imageNotFound(w http.ResponseWriter, status int) {
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", strconv.Itoa(len(notFoundImage200)))
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(status)
	w.Write(notFoundImage200)
}

// isImagePath checks if the URL path looks like an image request
func isImagePath(path string) bool {
	lower := strings.ToLower(path)
	for _, ext := range []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico", ".avif"} {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

// sendNotFound picks the right error format based on the request path:
// - image paths → PNG placeholder
// - everything else → XML NoSuchKey
func sendNotFound(w http.ResponseWriter, r *http.Request, status int) {
	if isImagePath(r.URL.Path) {
		imageNotFound(w, status)
	} else {
		HandleNotFound(w, r)
	}
}

// ─── Router ───────────────────────────────────────────────────────────────────

// Home dispatches requests to the appropriate handler
func (h *Handler) Home(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	if path == "/" {
		HandleNotFound(w, r)
		return
	}

	switch {
	case strings.HasSuffix(path, "/playlist.m3u8"):
		h.HandlePlaylist(w, r)
	case strings.HasSuffix(path, "/video.m3u8"):
		h.HandleVideo(w, r)
	case strings.HasSuffix(path, "/sprite/sprite.vtt"):
		h.HandleSpriteVTT(w, r)
	case strings.Contains(path, "/sprite/") && strings.HasSuffix(path, ".jpg"):
		h.HandleSpriteImage(w, r)
	case strings.HasPrefix(path, "/thumb/") && strings.HasSuffix(path, ".jpg"):
		h.HandlePoster(w, r)
	default:
		h.StreamFile(w, r)
	}
}
