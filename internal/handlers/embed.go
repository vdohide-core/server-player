package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"strings"
	"time"

	"server-player/internal/db/database"
	"server-player/internal/db/models"
	"server-player/internal/services"

	"go.mongodb.org/mongo-driver/bson"
)

// EmbedData holds data passed to the embed template
type EmbedData struct {
	Title        string
	Slug         string
	BaseColor    string
	CustomCss    template.CSS
	CustomJs     template.HTML
	AdJavascript template.HTML
	PlayerConfig template.JS
}

// Embed handles GET /embed/{fileSlug} — Video player embed page
func (h *Handler) Embed(w http.ResponseWriter, r *http.Request) {
	// ─── Step 0: Check maintenance mode ──────────────────────────────
	if services.IsMaintenanceMode() {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("CDN-Cache-Control", "max-age=60")
		templates.ExecuteTemplate(w, "maintenance.html", nil)
		return
	}

	// ─── Step 1: Extract slug from URL ───────────────────────────────
	path := strings.TrimPrefix(r.URL.Path, "/embed/")
	slug := strings.TrimSuffix(path, "/")

	if slug == "" {
		RenderError(w, "File not found", http.StatusNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// ─── Step 2: Find file by slug ───────────────────────────────────
	var file models.File
	err := database.Files().FindOne(ctx, bson.M{"slug": slug}).Decode(&file)
	if err != nil {
		log.Printf("⚠️ File not found: %s (error: %v)", slug, err)
		RenderError(w, "File not found", http.StatusNotFound)
		return
	}

	// Check if file is trashed or deleted
	if file.IsTrashed() || file.IsDeleted() {
		RenderError(w, "File not found", http.StatusNotFound)
		return
	}

	// ─── Step 3: Lookup custom domain ────────────────────────────────
	domain, isDomainRequest := services.FindDomain(r.Host)

	if isDomainRequest {
		// Request came from a non-localhost domain
		if domain == nil {
			// Domain not registered → 404
			RenderError(w, "Domain not found", http.StatusNotFound)
			return
		}
		if domain.Status != "active" {
			// Domain not verified yet
			RenderError(w, "Domain is not verified", http.StatusForbidden)
			return
		}
		if !domain.Enable {
			// Domain disabled
			RenderError(w, "Domain is disabled", http.StatusNotFound)
			return
		}
	}

	// ─── Step 4: spaceId access control ──────────────────────────────
	if !CheckDomainSpace(r, file.SpaceID) {
		RenderError(w, "File not found", http.StatusNotFound)
		return
	}

	// ─── Step 4b: Check space status ─────────────────────────────────
	// If file belongs to a space and that space has an error status → 404
	if file.SpaceID != nil && *file.SpaceID != "" {
		space := services.FindSpace(*file.SpaceID)
		if space != nil && space.Status == "error" {
			RenderError(w, "This content is currently unavailable", http.StatusNotFound)
			return
		}
	}

	// ─── Step 5: Find video media for this file ──────────────────────
	cursor, err := database.Medias().Find(ctx, bson.M{
		"fileId":     file.ID,
		"type":       models.MediaTypeVideo,
		"resolution": bson.M{"$in": []string{"original", "1080", "720", "480", "360"}},
		"deletedAt":  bson.M{"$eq": nil},
	})
	if err != nil {
		log.Printf("⚠️ Error finding media: %v", err)
		RenderError(w, "Error loading video", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	// Build medias map (resolution → slug)
	medias := make(map[string]string)
	hasTranscoded := false
	for cursor.Next(ctx) {
		var media models.Media
		if err := cursor.Decode(&media); err != nil {
			continue
		}
		res := ""
		if media.Resolution != nil {
			res = *media.Resolution
		}
		if res != "" {
			medias[res] = media.Slug
			if res == "1080" || res == "720" || res == "480" || res == "360" {
				hasTranscoded = true
			}
		}
	}

	// Hide "original" when transcoded resolutions are available
	if hasTranscoded {
		delete(medias, "original")
	}

	// ─── Step 6: If no valid media found, check video_process status ──
	if len(medias) == 0 {
		// Query video_process for this file
		var vp models.VideoProcess
		vpErr := database.VideoProcess().FindOne(ctx, bson.M{"fileId": file.ID}).Decode(&vp)

		type ProcessingData struct {
			State   string // "processing" | "queue" | "error"
			Message string
			Percent float64
		}

		var pd ProcessingData
		if vpErr != nil {
			// No video_process record → waiting in queue
			pd = ProcessingData{State: "queue"}
		} else {
			status := ""
			if vp.Status != nil {
				status = *vp.Status
			}
			if status == "failed" {
				errMsg := "เกิดข้อผิดพลาดในการประมวลผล"
				if vp.Error != nil && *vp.Error != "" {
					errMsg = *vp.Error
				}
				pd = ProcessingData{State: "error", Message: errMsg}
			} else {
				pct := 0.0
				if vp.OverallPercent != nil {
					pct = *vp.OverallPercent
				}
				pd = ProcessingData{State: "processing", Percent: pct}
			}
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("CDN-Cache-Control", "max-age=60")
		if err := templates.ExecuteTemplate(w, "processing.html", pd); err != nil {
			log.Printf("⚠️ Template error: %v", err)
			RenderError(w, "Processing...", http.StatusInternalServerError)
		}
		return
	}

	// ─── Step 7: Build content URLs ─────────────────────────
	playlistHost := services.GetDomainPlaylist(r.Host)
	adsHost := services.GetDomainAds(r.Host)
	previewHost := services.GetDomainPreview()

	reqProto := "http"
	if r.TLS != nil {
		reqProto = "https"
	}
	
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		if strings.Contains(strings.ToLower(proto), "https") {
			reqProto = "https"
		} else {
			reqProto = "http"
		}
	} else if cfVisitor := r.Header.Get("CF-Visitor"); strings.Contains(cfVisitor, `"scheme":"https"`) {
		reqProto = "https"
	} else if r.Header.Get("X-Forwarded-Ssl") == "on" || r.Header.Get("X-Forwarded-Scheme") == "https" || r.Header.Get("X-Url-Scheme") == "https" {
		reqProto = "https"
	}

	getProtocol := func(host string) string {
		if strings.HasPrefix(host, "localhost") || strings.HasPrefix(host, "127.0.0.1") || strings.HasPrefix(host, "192.168.") || strings.HasPrefix(host, "10.") {
			return "http"
		}
		// Force HTTPS for external domains (like CDNs) to prevent Mixed Content
		if host != r.Host {
			return "https"
		}
		// Force HTTPS for public domains (no port specified) even if headers were missing
		if reqProto == "http" && !strings.Contains(host, ":") {
			return "https"
		}
		return reqProto
	}

	playlistProtocol := getProtocol(playlistHost)
	adsProtocol := getProtocol(adsHost)

	// ─── Step 8: Find poster image ─────────────────────────────────────
	posterURL := ""
	var posterMedia models.Media
	err = database.Medias().FindOne(ctx, bson.M{
		"fileId":     file.ID,
		"type":       models.MediaTypeImage,
		"resolution": models.ResolutionPoster,
		"deletedAt":  bson.M{"$eq": nil},
	}).Decode(&posterMedia)
	if err == nil && posterMedia.StorageID != nil && *posterMedia.StorageID != "" {
		var storage models.Storage
		if sErr := database.Storages().FindOne(ctx, bson.M{"_id": *posterMedia.StorageID}).Decode(&storage); sErr == nil {
			if storage.PublicURL != nil && *storage.PublicURL != "" {
				posterURL = strings.TrimRight(*storage.PublicURL, "/") + "/" + posterMedia.Slug + "/poster.jpg"
			}
		}
	}

	playlistURL := playlistProtocol + "://" + playlistHost + "/" + slug + "/playlist.m3u8"

	// Fallback poster from content server thumbnail
	if posterURL == "" {
		thumbTime := 0
		if file.Metadata != nil && file.Metadata.Duration != nil {
			thumbTime = int(*file.Metadata.Duration / 2)
		}
		if previewHost != "" {
			previewProtocol := getProtocol(previewHost)
			posterURL = previewProtocol + "://" + previewHost + "/thumb/" + slug + "/" + fmt.Sprintf("%d", thumbTime) + ".jpg"
		} else {
			posterURL = "/thumb/" + slug + "/" + fmt.Sprintf("%d", thumbTime) + ".jpg"
		}
	}

	// ─── Step 8.5: Find thumbnail sprite VTT ──────────────────────────
	spriteVttURL := ""
	var thumbMedia models.Media
	tErr := database.Medias().FindOne(ctx, bson.M{
		"fileId":    file.ID,
		"type":      models.MediaTypeThumbnail,
		"deletedAt": nil,
	}).Decode(&thumbMedia)
	if tErr == nil {
		if previewHost != "" {
			previewProtocol := getProtocol(previewHost)
			spriteVttURL = previewProtocol + "://" + previewHost + "/" + slug + "/sprite/sprite.vtt"
		} else {
			spriteVttURL = "/" + slug + "/sprite/sprite.vtt"
		}
	}

	// ─── Step 9: Build player config ──────────────────────────────────
	var playerConfig services.PlayerConfig
	baseColor := "#ff6700"
	customCss := ""
	customJs := ""

	// ── Determine space plan type ──────────────────────────────────────
	// Lookup the space this file belongs to (from memory cache)
	planType := "hobby"
	if file.SpaceID != nil && *file.SpaceID != "" {
		if plan := services.GetSpacePlan(*file.SpaceID); plan != nil {
			planType = plan.PlanType
		}
	}

	// ── Build base player config from domain or global settings ────────
	if domain != nil {
		playerConfig = services.BuildPlayerConfigFromDomain(
			file.Name, posterURL, playlistURL, medias, domain,
		)
		if domain.Player != nil && domain.Player.BaseColor != "" {
			baseColor = domain.Player.BaseColor
		}
	} else {
		globalSettings := services.GetPlayerSettings()
		baseColor = globalSettings.BaseColor
		playerConfig = services.BuildPlayerConfig(
			file.Name, posterURL, playlistURL, medias, globalSettings,
		)
	}

	// ── Resolve ads based on plan type ─────────────────────────────────
	// hobby → global ads from setting.json (advert_vdo / advert_image / advert_javascript)
	// pro/business/enterprise → ads from ads collection (by spaceId)
	spaceID := ""
	if file.SpaceID != nil {
		spaceID = *file.SpaceID
	}

	ads := services.ResolveAdsFromPlan(planType, spaceID)

	// ── Filter ads by domain.Ads whitelist ─────────────────────────────
	// When a domain has an Ads config, it acts as a whitelist:
	//   - domain.Ads.Video  → only show video ads with these IDs (empty = no video ads)
	//   - domain.Ads.Image  → only show image ads with these IDs (empty/nil = no image ads)
	//   - domain.Ads.Script → only show script ads with these IDs (empty/nil = no script ads)
	// If domain.Ads is nil, all resolved ads pass through (no filtering).
	if domain != nil && domain.Ads != nil {
		// Filter image ads: only keep ads whose ID is in domain.Ads.Image
		if len(domain.Ads.Image) > 0 {
			var filteredImages []services.AdvertImageConfig
			for _, id := range domain.Ads.Image {
				ad := services.FindAdByID(id)
				if ad != nil && ad.Type == "image" && ad.Content != nil &&
					ad.Content.ImageURL != nil && *ad.Content.ImageURL != "" {
					websiteUrl := ""
					if ad.Content.WebsiteURL != nil {
						websiteUrl = *ad.Content.WebsiteURL
					}
					filteredImages = append(filteredImages, services.AdvertImageConfig{
						ImageUrl:   *ad.Content.ImageURL,
						WebsiteUrl: websiteUrl,
						ShowOn:     ad.Content.ShowOn,
					})
				}
			}
			ads.AdvertImages = filteredImages
		} else {
			// domain.Ads exists but Image is empty/nil → no image ads
			ads.AdvertImages = nil
		}

		// Filter script ads: only keep ads whose ID is in domain.Ads.Script
		if len(domain.Ads.Script) > 0 {
			var filteredScripts []string
			for _, id := range domain.Ads.Script {
				ad := services.FindAdByID(id)
				if ad != nil && (ad.Type == "script" || ad.Type == "javascript") && ad.Content != nil &&
					ad.Content.Script != nil && *ad.Content.Script != "" {
					filteredScripts = append(filteredScripts, *ad.Content.Script)
				}
			}
			ads.AdJavascripts = filteredScripts
		} else {
			// domain.Ads exists but Script is empty/nil → no script ads
			ads.AdJavascripts = nil
		}

		// Filter video ads: if domain.Ads.Video is empty → disable VAST
		if len(domain.Ads.Video) == 0 {
			ads.VastEnabled = false
		}
	}

	// Apply resolved ads to player config
	// Hobby plan → /vast/hobby.xml
	// Paid plan with domain → /vast/{domainSlug}.xml (if domain has video ads)
	if ads.VastEnabled {
		adsBaseUrl := adsProtocol + "://" + adsHost
		if planType == "" || planType == models.PlanTypeHobby {
			playerConfig.VastURL = adsBaseUrl + "/vast/hobby.xml"
		} else if domain != nil && domain.Slug != "" {
			playerConfig.VastURL = adsBaseUrl + fmt.Sprintf("/vast/%s.xml", domain.Slug)
		}
	}
	playerConfig.AdvertImages = ads.AdvertImages
	adJavascript := strings.Join(ads.AdJavascripts, "\n")

	// Set sprite VTT URL if thumbnails exist
	playerConfig.SpriteVttUrl = spriteVttURL

	configJSON, _ := json.Marshal(playerConfig)

	// ─── Step 10: Render template ──────────────────────────────────────
	data := EmbedData{
		Title:        file.Name,
		Slug:         slug,
		BaseColor:    baseColor,
		CustomCss:    template.CSS(customCss),
		CustomJs:     template.HTML(customJs),
		AdJavascript: template.HTML(adJavascript),
		PlayerConfig: template.JS(configJSON),
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("CDN-Cache-Control", "max-age=14400")
	if err := templates.ExecuteTemplate(w, "embed.html", data); err != nil {
		log.Printf("⚠️ Template error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}
