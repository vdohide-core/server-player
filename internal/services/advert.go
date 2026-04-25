package services

import (
	"encoding/json"
	"log"
)

// ─── Advert Video (advert_vdo) ────────────────────────────────────────

// AdvertVdoItem represents a single video ad entry
type AdvertVdoItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	MP4Url      string `json:"mp4Url"`
	WebsiteUrl  string `json:"websiteUrl"`
	SkipSeconds int    `json:"skipSeconds"`
	IsActive    bool   `json:"isActive"`
}

// AdvertVdo represents the advert_vdo setting
type AdvertVdo struct {
	IsActive bool            `json:"isActive"` // master switch
	Items    []AdvertVdoItem `json:"items"`
}

// GetAdvertVdo reads advert_vdo settings from setting.json
// Format: array of AdvertVdoItem directly (not wrapped in object)
func GetAdvertVdo() []AdvertVdoItem {
	settings, err := ReadSettingFile()
	if err != nil {
		log.Printf("⚠️ Cannot read setting.json (advert_vdo): %v", err)
		return nil
	}
	raw, exists := settings["advert_vdo"]
	if !exists {
		return nil
	}
	var items []AdvertVdoItem
	if err := json.Unmarshal(raw, &items); err != nil {
		log.Printf("⚠️ Cannot parse advert_vdo: %v", err)
		return nil
	}
	return items
}

// ─── Advert Image (advert_image) ─────────────────────────────────────

// AdvertImage represents the advert_image setting
type AdvertImageSetting struct {
	IsActive   bool     `json:"isActive"`
	ImageUrl   string   `json:"imageUrl"`
	WebsiteUrl string   `json:"websiteUrl"`
	ShowOn     []string `json:"showOn"` // ready, end, pause
}

// GetAdvertImage reads advert_image settings from setting.json
func GetAdvertImage() AdvertImageSetting {
	defaults := AdvertImageSetting{}
	settings, err := ReadSettingFile()
	if err != nil {
		log.Printf("⚠️ Cannot read setting.json (advert_image): %v", err)
		return defaults
	}
	raw, exists := settings["advert_image"]
	if !exists {
		return defaults
	}
	var result AdvertImageSetting
	if err := json.Unmarshal(raw, &result); err != nil {
		log.Printf("⚠️ Cannot parse advert_image: %v", err)
		return defaults
	}
	return result
}

// ─── Advert Javascript (advert_javascript) ───────────────────────────

// AdvertJavascriptSetting represents the advert_javascript setting
// Format: plain string (raw script HTML)
type AdvertJavascriptSetting struct {
	Code string // the raw value from setting.json
}

// GetAdvertJavascript reads advert_javascript settings from setting.json
// Format: plain string directly
func GetAdvertJavascript() AdvertJavascriptSetting {
	settings, err := ReadSettingFile()
	if err != nil {
		log.Printf("⚠️ Cannot read setting.json (advert_javascript): %v", err)
		return AdvertJavascriptSetting{}
	}
	raw, exists := settings["advert_javascript"]
	if !exists {
		return AdvertJavascriptSetting{}
	}
	// Try as plain string first
	var code string
	if err := json.Unmarshal(raw, &code); err != nil {
		log.Printf("⚠️ Cannot parse advert_javascript: %v", err)
		return AdvertJavascriptSetting{}
	}
	return AdvertJavascriptSetting{Code: code}
}

// ─── Resolved Ad Config ───────────────────────────────────────────────

// ResolvedAds is the final ad configuration passed to the player/vast
type ResolvedAds struct {
	// VAST video ads
	VastEnabled bool
	VdoItems    []AdvertVdoItem

	// Image overlay ad
	AdvertImage *AdvertImageConfig

	// Javascript ad code
	AdJavascript string
}

// ResolveAds returns the appropriate ad configuration based on space plan type.
//
// Rules:
//   - planType == "free" (or no plan) → use global ads from setting.json
//   - planType == "paid" → use domain-level ads (domain may have own advert config)
//   - domain == nil → always use global ads from setting.json
func ResolveAds(spaceID string, domain interface{ GetAdvert() interface{} }) ResolvedAds {
	// Intentionally simple: caller passes planType directly
	return ResolvedAds{}
}

// ResolveAdsFromPlan selects ad config based on plan type and domain.
//
//   - planType "free" or "" → VAST always enabled; JS/image from setting.json
//   - planType "paid"       → use domain ads only
func ResolveAdsFromPlan(planType string, domainVast bool, domainAdvertImage *AdvertImageConfig, domainJavascript string) ResolvedAds {
	if planType == "paid" {
		return ResolvedAds{
			VastEnabled:  domainVast,
			AdvertImage:  domainAdvertImage,
			AdJavascript: domainJavascript,
		}
	}

	// Free (or no plan): VAST always enabled, JS/image from setting.json
	result := ResolvedAds{
		VastEnabled: true, // always — /vast.xml returns empty VAST if no ads configured
	}

	// Image ad from setting.json
	img := GetAdvertImage()
	if img.IsActive && img.ImageUrl != "" {
		result.AdvertImage = &AdvertImageConfig{
			ImageUrl:   img.ImageUrl,
			WebsiteUrl: img.WebsiteUrl,
			ShowOn:     img.ShowOn,
		}
	}

	// Javascript ad from setting.json (plain string)
	js := GetAdvertJavascript()
	if js.Code != "" {
		result.AdJavascript = js.Code
	}

	return result
}

// ─── Legacy helpers ───────────────────────────────────────────────────

// IsAdvertVideoEnabled returns whether global video ads have any active items
func IsAdvertVideoEnabled() bool {
	items := GetAdvertVdo()
	for _, item := range items {
		if item.IsActive {
			return true
		}
	}
	return false
}
