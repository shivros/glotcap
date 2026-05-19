package convex

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	apiQueryEndpoint    = "/api/query"
	apiMutationEndpoint = "/api/mutation"
	apiActionEndpoint   = "/api/action"
	defaultTimeout      = 60 * time.Second
)

// Client is an HTTP client for the Convex backend.
type Client struct {
	baseURL    string
	authToken  string
	httpClient *http.Client
}

// NewClient creates a new Convex API client.
func NewClient(convexURL, authToken string) *Client {
	return &Client{
		baseURL:   convexURL,
		authToken: authToken,
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

// Query executes a Convex query function.
func (c *Client) Query(ctx context.Context, functionPath string, args map[string]any) (json.RawMessage, error) {
	return c.doRequest(ctx, apiQueryEndpoint, functionPath, args)
}

// Mutation executes a Convex mutation function.
func (c *Client) Mutation(ctx context.Context, functionPath string, args map[string]any) (json.RawMessage, error) {
	return c.doRequest(ctx, apiMutationEndpoint, functionPath, args)
}

// Action executes a Convex action function.
func (c *Client) Action(ctx context.Context, functionPath string, args map[string]any) (json.RawMessage, error) {
	return c.doRequest(ctx, apiActionEndpoint, functionPath, args)
}

// HTTPStream POSTs JSON to a custom HTTP route and returns the raw response body.
func (c *Client) HTTPStream(ctx context.Context, route string, body map[string]any) (io.ReadCloser, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("convex URL not configured; set CONVEX_URL or run 'glotcap auth login'")
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	url := strings.TrimRight(c.baseURL, "/") + route
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.authToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("making request to %s: %w", route, err)
	}

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	return resp.Body, nil
}

func (c *Client) doRequest(ctx context.Context, endpoint, functionPath string, args map[string]any) (json.RawMessage, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("convex URL not configured; set CONVEX_URL or run 'glotcap auth login'")
	}

	reqBody := NewRequest(functionPath, args)
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	url := strings.TrimRight(c.baseURL, "/") + endpoint
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.authToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("making request to %s: %w", functionPath, err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var apiResp Response
	if err := json.Unmarshal(respBytes, &apiResp); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}

	if apiResp.ErrorMessage != "" {
		return nil, fmt.Errorf("Convex error: %s", apiResp.ErrorMessage)
	}

	return apiResp.Value, nil
}
