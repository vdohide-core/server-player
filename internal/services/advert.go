package services

import (
	"encoding/json"
	"log"

	"server-player/internal/db/models"
)

// ─── Advert Hobby (advert_hobby) ─────────────────────────────────────

// GetAdvertHobby reads advert_hobby from setting.json (ResultDomainAdvert format).
func GetAdvertHobby() *models.DomainAdverts {
	settings, err := ReadSettingFile()
	if err != nil {
		return nil
	}
	raw, exists := settings["advert_hobby"]
	if !exists {
		return nil
	}
	var result models.DomainAdverts
	if err := json.Unmarshal(raw, &result); err != nil {
		log.Printf("⚠️ Cannot parse advert_hobby: %v", err)
		return nil
	}
	return &result
}

// ─── Resolved Ad Config ───────────────────────────────────────────────

// ResolvedAds is the final ad configuration passed to the player/vast.
type ResolvedAds struct {
	VastEnabled    bool
	AdvertImages   []AdvertImageConfig
	AdJavascripts  []string
}

// ResolveAdsFromAdverts converts embedded domain adverts into ResolvedAds.
func ResolveAdsFromAdverts(adverts *models.DomainAdverts) ResolvedAds {
	result := ResolvedAds{}
	if adverts == nil {
		return result
	}

	if adverts.Video.Enabled {
		for _, ad := range adverts.Video.List {
			if !ad.Enabled {
				continue
			}
			if ad.MP4URL != nil && *ad.MP4URL != "" {
				result.VastEnabled = true
			}
		}
	}

	if adverts.Image.Enabled {
		for _, ad := range adverts.Image.List {
			if !ad.Enabled {
				continue
			}
			if ad.ImageURL != nil && *ad.ImageURL != "" {
				websiteURL := ""
				if ad.WebsiteURL != nil {
					websiteURL = *ad.WebsiteURL
				}
				result.AdvertImages = append(result.AdvertImages, AdvertImageConfig{
					ImageUrl:   *ad.ImageURL,
					WebsiteUrl: websiteURL,
					ShowOn:     ad.ShowOn,
				})
			}
		}
	}

	if adverts.Script.Enabled {
		for _, ad := range adverts.Script.List {
			if !ad.Enabled {
				continue
			}
			if ad.Script != nil && *ad.Script != "" {
				result.AdJavascripts = append(result.AdJavascripts, *ad.Script)
			}
		}
	}

	return result
}

// ResolveAdSlug returns the ad feed slug: "hobby" or custom domain slug.
func ResolveAdSlug(planType string, domain *models.CustomDomain, spaceID *string) string {
	if planType != "" && planType != models.PlanTypeHobby {
		if domain != nil && domain.Slug != "" {
			return domain.Slug
		}
		if spaceID != nil && *spaceID != "" {
			if slug := FindDomainSlugBySpaceID(*spaceID); slug != "" {
				return slug
			}
		}
		return ""
	}
	return "hobby"
}

// ResolveAdvertsBySlug loads advert config for hobby or a domain slug.
func ResolveAdvertsBySlug(adSlug string) *models.DomainAdverts {
	if adSlug == "" || adSlug == "hobby" {
		return GetAdvertHobby()
	}
	domain := FindDomainBySlug(adSlug)
	if domain == nil {
		return nil
	}
	return domain.Adverts
}

// ResolveImageAdsBySlug returns image overlay ads for an ad feed slug.
func ResolveImageAdsBySlug(adSlug string) []AdvertImageConfig {
	return ResolveAdsFromAdverts(ResolveAdvertsBySlug(adSlug)).AdvertImages
}

// ResolveScriptAdsBySlug returns script adverts for an ad feed slug.
func ResolveScriptAdsBySlug(adSlug string) []string {
	return ResolveAdsFromAdverts(ResolveAdvertsBySlug(adSlug)).AdJavascripts
}

// BuildImageAdsFeed builds /image/{adSlug}.json in static host format.
func BuildImageAdsFeed(adSlug string) AdvertCategoryFeed {
	adverts := ResolveAdvertsBySlug(adSlug)
	feed := AdvertCategoryFeed{Enabled: false, List: []AdvertFeedListItem{}}
	if adverts == nil || !adverts.Image.Enabled {
		return feed
	}

	for _, ad := range adverts.Image.List {
		if !ad.Enabled || ad.ImageURL == nil || *ad.ImageURL == "" {
			continue
		}
		item := AdvertFeedListItem{
			ID:       ad.ID,
			Name:     ad.Name,
			ImageUrl: *ad.ImageURL,
			ShowOn:   ad.ShowOn,
		}
		if ad.WebsiteURL != nil {
			item.WebsiteUrl = *ad.WebsiteURL
		}
		feed.List = append(feed.List, item)
	}
	feed.Enabled = len(feed.List) > 0
	return feed
}

// BuildScriptAdsFeed builds /script/{adSlug}.json in static host format.
func BuildScriptAdsFeed(adSlug string) AdvertCategoryFeed {
	adverts := ResolveAdvertsBySlug(adSlug)
	feed := AdvertCategoryFeed{Enabled: false, List: []AdvertFeedListItem{}}
	if adverts == nil || !adverts.Script.Enabled {
		return feed
	}

	for _, ad := range adverts.Script.List {
		if !ad.Enabled || ad.Script == nil || *ad.Script == "" {
			continue
		}
		feed.List = append(feed.List, AdvertFeedListItem{
			ID:     ad.ID,
			Name:   ad.Name,
			Script: *ad.Script,
		})
	}
	feed.Enabled = len(feed.List) > 0
	return feed
}

// ResolveAdsFromPlan selects ad config based on plan type.
//
//   - planType "hobby" or "" → adverts from advert_hobby setting
//   - paid plans → adverts embedded on the custom domain
func ResolveAdsFromPlan(planType string, domain *models.CustomDomain) ResolvedAds {
	if planType != "" && planType != models.PlanTypeHobby {
		if domain != nil {
			return ResolveAdsFromAdverts(domain.Adverts)
		}
		return ResolvedAds{}
	}

	return ResolveAdsFromAdverts(GetAdvertHobby())
}

// ActiveVideoAds returns enabled video ads with a valid mp4 URL.
func ActiveVideoAds(adverts *models.DomainAdverts) []models.AdContent {
	if adverts == nil || !adverts.Video.Enabled {
		return nil
	}

	var active []models.AdContent
	for _, ad := range adverts.Video.List {
		if !ad.Enabled {
			continue
		}
		if ad.MP4URL == nil || *ad.MP4URL == "" {
			continue
		}
		active = append(active, ad)
	}
	return active
}
