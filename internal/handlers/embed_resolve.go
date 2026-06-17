package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"server-player/internal/db/models"
	"server-player/internal/services"

	"go.mongodb.org/mongo-driver/bson"
)

// ProcessingData is passed to processing.html when video is not ready.
type ProcessingData struct {
	State   string
	Message string
	Percent float64
}

// EmbedContent holds resolved media URLs for a file embed.
type EmbedContent struct {
	ReqProto       string
	PlaylistHost   string
	StaticHost     string
	PreviewHost    string
	PosterURL      string
	PlaylistM3U8   string
	SpriteVttURL   string
	PlaylistFeedURL string
}

// EmbedResolveResult is the shared embed / playlist feed resolution output.
type EmbedResolveResult struct {
	File         models.File
	Slug         string
	Domain       *models.CustomDomain
	Medias       map[string]string
	PlanType     string
	Content      EmbedContent
	Ads          services.ResolvedAds
	VastURL      string
	EmbedConfig  services.EmbedPlayerConfig
}

// EmbedResolveError describes a failed embed resolution.
type EmbedResolveError struct {
	Status     int
	Message    string
	Processing *ProcessingData
}

func requestProtocol(r *http.Request) string {
	proto := "http"
	if r.TLS != nil {
		proto = "https"
	}

	if p := r.Header.Get("X-Forwarded-Proto"); p != "" {
		if strings.Contains(strings.ToLower(p), "https") {
			return "https"
		}
		return "http"
	}
	if cfVisitor := r.Header.Get("CF-Visitor"); strings.Contains(cfVisitor, `"scheme":"https"`) {
		return "https"
	}
	if r.Header.Get("X-Forwarded-Ssl") == "on" ||
		r.Header.Get("X-Forwarded-Scheme") == "https" ||
		r.Header.Get("X-Url-Scheme") == "https" {
		return "https"
	}

	return proto
}

func (h *Handler) resolveEmbed(r *http.Request, slug string) (*EmbedResolveResult, *EmbedResolveError) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var file models.File
	err := models.FileModel.Col().FindOne(ctx, bson.M{"slug": slug}).Decode(&file)
	if err != nil {
		return nil, &EmbedResolveError{Status: http.StatusNotFound, Message: "File not found"}
	}

	if file.IsTrashed() || file.IsDeleted() {
		return nil, &EmbedResolveError{Status: http.StatusNotFound, Message: "File not found"}
	}

	domain, isDomainRequest := services.FindDomain(r.Host)
	if isDomainRequest {
		if domain == nil {
			return nil, &EmbedResolveError{Status: http.StatusNotFound, Message: "Domain not found"}
		}
		if domain.Status != "active" {
			return nil, &EmbedResolveError{Status: http.StatusForbidden, Message: "Domain is not verified"}
		}
		if !domain.Enable {
			return nil, &EmbedResolveError{Status: http.StatusNotFound, Message: "Domain is disabled"}
		}
	}

	if !CheckDomainSpace(r, file.SpaceID) {
		return nil, &EmbedResolveError{Status: http.StatusNotFound, Message: "File not found"}
	}

	if file.SpaceID != nil && *file.SpaceID != "" {
		space := services.FindSpace(*file.SpaceID)
		if space != nil && space.Status == "error" {
			return nil, &EmbedResolveError{Status: http.StatusNotFound, Message: "This content is currently unavailable"}
		}
	}

	cursor, err := models.MediaModel.Col().Find(ctx, bson.M{
		"fileId":     file.ID,
		"type":       models.MediaTypeVideo,
		"resolution": bson.M{"$in": []string{"original", "1080", "720", "480", "360"}},
		"deletedAt":  bson.M{"$eq": nil},
	})
	if err != nil {
		return nil, &EmbedResolveError{Status: http.StatusInternalServerError, Message: "Error loading video"}
	}
	defer cursor.Close(ctx)

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

	if hasTranscoded {
		delete(medias, "original")
	}

	if len(medias) == 0 {
		var vp models.VideoProcess
		vpErr := models.VideoProcessModel.Col().FindOne(ctx, bson.M{"fileId": file.ID}).Decode(&vp)

		pd := &ProcessingData{State: "queue"}
		if vpErr == nil {
			status := ""
			if vp.Status != nil {
				status = *vp.Status
			}
			if status == "failed" {
				errMsg := "เกิดข้อผิดพลาดในการประมวลผล"
				if vp.Error != nil && *vp.Error != "" {
					errMsg = *vp.Error
				}
				pd = &ProcessingData{State: "error", Message: errMsg}
			} else {
				pct := 0.0
				if vp.OverallPercent != nil {
					pct = *vp.OverallPercent
				}
				pd = &ProcessingData{State: "processing", Percent: pct}
			}
		}

		return nil, &EmbedResolveError{
			Status:     http.StatusNotFound,
			Message:    "Video not ready",
			Processing: pd,
		}
	}

	reqProto := requestProtocol(r)
	playlistHost := services.GetDomainPlaylist(r.Host)
	previewHost := services.GetDomainPreview()
	staticHost := services.GetDomainStatic()

	posterURL := ""
	var posterMedia models.Media
	err = models.MediaModel.Col().FindOne(ctx, bson.M{
		"fileId":     file.ID,
		"type":       models.MediaTypeImage,
		"resolution": models.ResolutionPoster,
		"deletedAt":  bson.M{"$eq": nil},
	}).Decode(&posterMedia)
	if err == nil && posterMedia.StorageID != nil && *posterMedia.StorageID != "" {
		var storage models.Storage
		if sErr := models.StorageModel.Col().FindOne(ctx, bson.M{"_id": *posterMedia.StorageID}).Decode(&storage); sErr == nil {
			if storage.PublicURL != nil && *storage.PublicURL != "" {
				posterURL = strings.TrimRight(*storage.PublicURL, "/") + "/" + posterMedia.Slug + "/poster.jpg"
			}
		}
	}

	playlistM3U8 := reqProto + "://" + playlistHost + "/" + slug + "/playlist.m3u8"

	if posterURL == "" {
		thumbTime := 0
		if file.Metadata != nil && file.Metadata.Duration != nil {
			thumbTime = int(*file.Metadata.Duration / 2)
		}
		if staticHost != "" {
			posterURL = reqProto + "://" + staticHost + "/thumb/" + slug + "/" + fmt.Sprintf("%d", thumbTime) + ".jpg"
		} else if previewHost != "" {
			posterURL = reqProto + "://" + previewHost + "/thumb/" + slug + "/" + fmt.Sprintf("%d", thumbTime) + ".jpg"
		} else {
			posterURL = "/thumb/" + slug + "/" + fmt.Sprintf("%d", thumbTime) + ".jpg"
		}
	}

	spriteVttURL := ""
	var thumbMedia models.Media
	tErr := models.MediaModel.Col().FindOne(ctx, bson.M{
		"fileId":    file.ID,
		"type":      models.MediaTypeThumbnail,
		"deletedAt": nil,
	}).Decode(&thumbMedia)
	if tErr == nil {
		if staticHost != "" {
			spriteVttURL = reqProto + "://" + staticHost + "/" + slug + "/sprite/sprite.vtt"
		} else if previewHost != "" {
			spriteVttURL = reqProto + "://" + previewHost + "/" + slug + "/sprite/sprite.vtt"
		} else {
			spriteVttURL = "/" + slug + "/sprite/sprite.vtt"
		}
	}

	playlistFeedURL := fmt.Sprintf("%s://%s/playlist/%s.json", reqProto, r.Host, slug)

	planType := "hobby"
	if file.SpaceID != nil && *file.SpaceID != "" {
		if plan := services.GetSpacePlan(*file.SpaceID); plan != nil {
			planType = plan.PlanType
		}
	}

	baseColor := "#ff6700"
	continuePlay := true
	continuePlayArk := false
	if domain != nil && domain.Player != nil {
		if domain.Player.BaseColor != "" {
			baseColor = domain.Player.BaseColor
		}
		continuePlay = domain.Player.ContinuePlay
		continuePlayArk = domain.Player.ContinuePlayArk
	} else {
		globalSettings := services.GetPlayerSettings()
		baseColor = globalSettings.BaseColor
		continuePlay = globalSettings.ContinuePlay
		continuePlayArk = globalSettings.ContinuePlayArk
	}

	adSlug := services.ResolveAdSlug(planType, domain, file.SpaceID)

	ads := services.ResolveAdsFromPlan(planType, domain)
	vastURL := ""
	if ads.VastEnabled {
		adsBaseURL := reqProto + "://" + staticHost
		if adSlug == "hobby" {
			vastURL = adsBaseURL + "/vast/hobby.xml"
		} else if adSlug != "" {
			vastURL = adsBaseURL + fmt.Sprintf("/vast/%s.xml", adSlug)
		}
	}

	embedConfig := services.EmbedPlayerConfig{
		AdSlug:              adSlug,
		BaseColor:           baseColor,
		ContinuePlayback:    continuePlay,
		ContinuePlaybackArk: continuePlayArk,
		Slug:                slug,
		Static:              staticHost,
	}

	return &EmbedResolveResult{
		File:     file,
		Slug:     slug,
		Domain:   domain,
		Medias:   medias,
		PlanType: planType,
		Ads:      ads,
		VastURL:  vastURL,
		EmbedConfig: embedConfig,
		Content: EmbedContent{
			ReqProto:        reqProto,
			PlaylistHost:    playlistHost,
			StaticHost:      staticHost,
			PreviewHost:     previewHost,
			PosterURL:       posterURL,
			PlaylistM3U8:    playlistM3U8,
			SpriteVttURL:    spriteVttURL,
			PlaylistFeedURL: playlistFeedURL,
		},
	}, nil
}
