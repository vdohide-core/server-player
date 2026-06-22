package handlers

import (
	"embed"
	"html/template"
	"log"
	"net/http"
	"strconv"
	"strings"

	"server-player/internal/assets"
	"server-player/internal/services"
)

//go:embed templates/*.html
var templatesFS embed.FS

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

		if !hasSpace && !hasCreator {
			return true
		}

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

		return false
	}
	return true
}

// ─── Not-Found Helpers ────────────────────────────────────────────────────────

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

func imageNotFound(w http.ResponseWriter, status int) {
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", strconv.Itoa(len(notFoundImage200)))
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(status)
	w.Write(notFoundImage200)
}

func isImagePath(path string) bool {
	lower := strings.ToLower(path)
	for _, ext := range []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico", ".avif"} {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}
	return false
}

func sendNotFound(w http.ResponseWriter, r *http.Request, status int) {
	if isImagePath(r.URL.Path) {
		imageNotFound(w, status)
	} else {
		HandleNotFound(w, r)
	}
}

// ─── Router ───────────────────────────────────────────────────────────────────

// Home dispatches content proxy requests (stream files, sprites).
func (h *Handler) Home(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	if path == "/" {
		HandleNotFound(w, r)
		return
	}

	switch {
	case strings.HasSuffix(path, "/sprite/sprite.vtt"):
		h.HandleSpriteVTT(w, r)
	case strings.Contains(path, "/sprite/") && strings.HasSuffix(path, ".jpg"):
		h.HandleSpriteImage(w, r)
	default:
		h.StreamFile(w, r)
	}
}
