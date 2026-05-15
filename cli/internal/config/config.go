package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Config holds CLI configuration including Convex URL and auth token.
type Config struct {
	ConvexURL string `json:"convex_url"`
	AuthToken string `json:"auth_token"`
}

// ConfigPath returns the path to the config file, respecting XDG_CONFIG_HOME.
func ConfigPath() (string, error) {
	configDir := os.Getenv("XDG_CONFIG_HOME")
	if configDir == "" {
		var err error
		configDir, err = os.UserConfigDir()
		if err != nil {
			return "", fmt.Errorf("resolving user config dir: %w", err)
		}
	}
	return filepath.Join(configDir, "glotcap", "config.json"), nil
}

// Load reads the config file from disk.
func Load() (*Config, error) {
	path, err := ConfigPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Config{}, nil
		}
		return nil, fmt.Errorf("reading config file %s: %w", path, err)
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing config file %s: %w", path, err)
	}
	return &cfg, nil
}

// Save writes the config file to disk, creating parent directories as needed.
func (c *Config) Save() error {
	path, err := ConfigPath()
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("creating config directory %s: %w", dir, err)
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling config: %w", err)
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("writing config file %s: %w", path, err)
	}
	return nil
}

// Resolve returns an effective Config by overlaying environment variables on
// top of the file-based config. Env vars take precedence.
func Resolve() (*Config, error) {
	cfg, err := Load()
	if err != nil {
		return nil, err
	}
	if v := os.Getenv("CONVEX_URL"); v != "" {
		cfg.ConvexURL = v
	}
	if v := os.Getenv("CONVEX_TOKEN"); v != "" {
		cfg.AuthToken = v
	}
	return cfg, nil
}

// Delete removes the config file from disk.
func Delete() error {
	path, err := ConfigPath()
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("deleting config file %s: %w", path, err)
	}
	return nil
}
