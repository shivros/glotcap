package convex

import "encoding/json"

// Request represents a generic Convex API request body.
type Request struct {
	Path   string         `json:"path"`
	Args   map[string]any `json:"args,omitempty"`
	Format string         `json:"format,omitempty"`
}

// Response represents a generic Convex API response.
type Response struct {
	Value        json.RawMessage `json:"value"`
	Status       int64           `json:"status,omitempty"`
	ErrorMessage string          `json:"errorMessage,omitempty"`
}

// NewRequest creates a Convex API request with JSON format.
func NewRequest(functionPath string, args map[string]any) *Request {
	if args == nil {
		args = map[string]any{}
	}
	return &Request{
		Path:   functionPath,
		Args:   args,
		Format: "json",
	}
}
