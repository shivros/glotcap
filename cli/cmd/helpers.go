package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/shivros/glotcap/cli/internal/config"
	"github.com/shivros/glotcap/cli/internal/convex"
)

// getClient resolves configuration and creates a Convex client.
func getClient() (*convex.Client, error) {
	cfg, err := config.Resolve()
	if err != nil {
		return nil, fmt.Errorf("loading config: %w", err)
	}
	if cfg.ConvexURL == "" {
		return nil, fmt.Errorf("convex URL not configured; set CONVEX_URL or run 'glotcap auth login'")
	}
	return convex.NewClient(cfg.ConvexURL, cfg.AuthToken), nil
}

// printJSON writes a JSON representation to stdout with pretty-printing.
func printJSON(v any) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

// printValue prints raw JSON value. If --json is set, outputs raw; otherwise
// pretty-prints.
func printValue(raw json.RawMessage) error {
	if isJSON() {
		fmt.Println(string(raw))
		return nil
	}
	return printJSON(raw)
}

// parseJSONArg unmarshals a JSON string into the provided target.
func parseJSONArg(s string, target any) error {
	return json.Unmarshal([]byte(s), target)
}

// printResult is a convenience that prints the result or error.
func printResult(val json.RawMessage, err error, label string) error {
	if err != nil {
		return fmt.Errorf("%s: %w", label, err)
	}
	return printValue(val)
}
