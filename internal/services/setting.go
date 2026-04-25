package services

import (
	"context"
	"encoding/json"
	"log"
	"os"

	"server-player/internal/db/database"
	"server-player/internal/db/models"

	"go.mongodb.org/mongo-driver/bson"
)

// ReadSettingFile reads and parses conf/setting.json.
// Returns a map of setting name → raw JSON bytes.
func ReadSettingFile() (map[string]json.RawMessage, error) {
	data, err := os.ReadFile(settingFilePath())
	if err != nil {
		return nil, err
	}
	var settings map[string]json.RawMessage
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil, err
	}
	return settings, nil
}

// ─── Database Setting Helpers ─────────────────────────────────────────

// GetDomainContent fetches the domain_content setting from database.
// Used to determine the content server hostname for playlist URLs.
func GetDomainContent(ctx context.Context) string {
	var setting models.Setting
	err := database.Settings().FindOne(ctx, bson.M{"name": "domain_content"}).Decode(&setting)
	if err != nil {
		return ""
	}
	if domainStr, ok := setting.Value.(string); ok && domainStr != "" {
		return domainStr
	}
	return ""
}

// GetDomainAsset fetches the domain_asset setting from database.
func GetDomainAsset(ctx context.Context) string {
	var setting models.Setting
	err := database.Settings().FindOne(ctx, bson.M{"name": "domain_asset"}).Decode(&setting)
	if err != nil {
		return ""
	}
	if domainStr, ok := setting.Value.(string); ok && domainStr != "" {
		return domainStr
	}
	return ""
}

// unused log helper
func logWarn(msg string, args ...interface{}) {
	log.Printf(msg, args...)
}
