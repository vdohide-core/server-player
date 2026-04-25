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

// Vast handles GET /vast.xml — generates VAST 3.0 XML from advert settings
func (h *Handler) Vast(w http.ResponseWriter, r *http.Request) {
	// ── Check domain-level ads from r.Host ──
	domain, found := services.FindDomain(r.Host)
	if found && domain != nil && domain.Enable && domain.Status == "active" && len(domain.Advert) > 0 {
		buildDomainVast(w, domain)
		return
	}

	// ── Fallback: global advert_vdo settings ──
	items := services.GetAdvertVdo()

	if len(items) == 0 {
		writeEmptyVast(w)
		return
	}

	// Build VAST XML with active ads only
	var ads strings.Builder
	for _, ad := range items {
		if !ad.IsActive {
			continue
		}

		adID := randomID(10)
		skipOffset := fmt.Sprintf("00:00:%02d", ad.SkipSeconds)

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
    </Ad>`, adID, html.EscapeString(ad.Name), skipOffset, html.EscapeString(ad.WebsiteUrl), adID, html.EscapeString(ad.MP4Url)))
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

// buildDomainVast builds VAST XML from domain-level advert config.
// Adapted for new pointer-field models.
func buildDomainVast(w http.ResponseWriter, domain *models.CustomDomain) {
	var ads strings.Builder
	hasActive := false

	for _, ad := range domain.Advert {
		// Pointer-safe active check
		if ad.IsActive == nil || !*ad.IsActive {
			continue
		}
		if ad.MP4URL == nil || *ad.MP4URL == "" {
			continue
		}
		hasActive = true

		adID := randomID(10)
		skipOffset := fmt.Sprintf("00:00:%02d", ad.SkipSeconds)

		name := ""
		if ad.Name != nil {
			name = *ad.Name
		}
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
    </Ad>`, adID, html.EscapeString(name), skipOffset, html.EscapeString(websiteURL), adID, html.EscapeString(*ad.MP4URL)))
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
