package handlers

import (
	"fmt"
	"html"
	"math/rand"
	"net/http"
	"strings"

	"server-player/internal/db/models"
	"server-player/internal/services"
)

// Vast handles GET /vast/{domainSlug}.xml — generates VAST 3.0 XML from adverts
func (h *Handler) Vast(w http.ResponseWriter, r *http.Request) {
	// ── Extract slug from path: /vast/{slug}.xml ──
	path := strings.TrimPrefix(r.URL.Path, "/vast/")
	slug := strings.TrimSuffix(path, ".xml")

	if slug == "" {
		writeEmptyVast(w)
		return
	}

	// ── Special case: hobby plan adverts ──
	if slug == "hobby" {
		hobby := services.GetAdvertHobby()
		videoAds := services.ActiveVideoAds(hobby)
		if len(videoAds) == 0 {
			writeEmptyVast(w)
			return
		}
		buildAdvertsVast(w, videoAds)
		return
	}

	// ── Find domain by slug ──
	domain := services.FindDomainBySlug(slug)
	if domain == nil || !domain.Enable || domain.Status != "active" {
		writeEmptyVast(w)
		return
	}

	videoAds := services.ActiveVideoAds(domain.Adverts)
	if len(videoAds) == 0 {
		writeEmptyVast(w)
		return
	}

	buildAdvertsVast(w, videoAds)
}

// buildAdvertsVast builds VAST XML from embedded video advert entries.
func buildAdvertsVast(w http.ResponseWriter, adList []models.AdContent) {
	var ads strings.Builder
	hasActive := false

	for _, ad := range adList {
		if ad.MP4URL == nil || *ad.MP4URL == "" {
			continue
		}
		hasActive = true

		adID := randomID(10)
		skipSeconds := 5
		if ad.SkipSeconds != nil {
			skipSeconds = *ad.SkipSeconds
		}
		skipOffset := fmt.Sprintf("00:00:%02d", skipSeconds)

		websiteURL := ""
		if ad.WebsiteURL != nil {
			websiteURL = *ad.WebsiteURL
		}

		ads.WriteString(fmt.Sprintf(`
    <Ad id="%s" sequence="0">
      <InLine>
        <AdSystem version="2.0">JW Player</AdSystem>
        <AdTitle>%s</AdTitle>
        <Creatives>
          <Creative sequence="0">
            <Linear skipoffset="%s">
              <VideoClicks>
                <ClickThrough>%s</ClickThrough>
              </VideoClicks>
              <MediaFiles>
                <MediaFile
                  id="%s"
                  delivery="progressive"
                  type="video/mp4"
                  bitrate="400"
                  width="640"
                  height="360"
                >%s</MediaFile>
              </MediaFiles>
            </Linear>
          </Creative>
          <Creative> </Creative>
        </Creatives>
      </InLine>
    </Ad>`, adID, html.EscapeString(ad.Name), skipOffset, html.EscapeString(websiteURL), adID, html.EscapeString(*ad.MP4URL)))
	}

	if !hasActive {
		writeEmptyVast(w)
		return
	}

	vast := fmt.Sprintf(`<?xml version="1.0"?>
<VAST
  version="3.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:noNamespaceSchemaLocation="vast3_draft.xsd"
>%s
</VAST>`, ads.String())

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Write([]byte(vast))
}

// writeEmptyVast writes an empty VAST response
func writeEmptyVast(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Write([]byte(`<?xml version="1.0"?>
<VAST version="3.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="vast3_draft.xsd">
</VAST>`))
}

// randomID generates a random alphanumeric string of given length
func randomID(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
