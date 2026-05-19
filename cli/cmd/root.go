package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var jsonOutput bool

// rootCmd is the base command for the GlotCap CLI.
var rootCmd = &cobra.Command{
	Use:   "glotcap",
	Short: "GlotCap CLI — access the GlotCap Convex backend from the command line",
	Long: `GlotCap CLI exposes the full GlotCap language-learning backend via command line.

Command groups:
  auth         Manage authentication (login, logout, status)
  account      Email change management
  speaking     Manage speaking sessions (start, end, pause, resume, etc.)
  coach        AI coach streaming interactions
  events       Append session events, transcripts, translations
  corrections  Analyze text for corrections
  vocabulary   Analyze text for vocabulary
  translations Translate text between languages
  tts          Text-to-speech synthesis and streaming
  stt          Speech-to-text session management
  insights     View and manage learning insights
  media        Media upload and processing jobs
  preferences  Get/set language preferences
  invites      Validate and consume invite codes
  version      Show CLI version

Use --json for machine-readable output suitable for LLM consumption.
Set JOINED=1 environment variable to auto-enable JSON output.`,
	SilenceUsage:  true,
	SilenceErrors: true,
}

// Execute runs the root command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().BoolVar(&jsonOutput, "json", false, "output results as JSON")
}

// isJSON returns whether the global --json flag is set or JOINED=1 env is present.
func isJSON() bool {
	if jsonOutput {
		return true
	}
	return os.Getenv("JOINED") == "1"
}
