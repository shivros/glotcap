package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var sttCmd = &cobra.Command{
	Use:   "stt",
	Short: "Speech-to-text session management",
	Long:  `Create and manage speech-to-text transcription sessions.`,
}

var sttCreateSessionCmd = &cobra.Command{
	Use:   "create-session <sessionId>",
	Short: "Create a new STT session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		sampleRate, _ := cmd.Flags().GetInt("sample-rate")
		if sampleRate <= 0 {
			return fmt.Errorf("--sample-rate is required and must be > 0")
		}
		cmdArgs := map[string]any{
			"sessionId":  args[0],
			"sampleRate": sampleRate,
		}
		provider, _ := cmd.Flags().GetString("provider")
		if provider != "" {
			cmdArgs["provider"] = provider
		}
		language, _ := cmd.Flags().GetString("language")
		if language != "" {
			cmdArgs["language"] = language
		}
		model, _ := cmd.Flags().GetString("model")
		if model != "" {
			cmdArgs["model"] = model
		}
		val, err := client.Action(cmd.Context(), "stt:createSession", cmdArgs)
		return printResult(val, err, "creating STT session")
	},
}

func init() {
	sttCreateSessionCmd.Flags().Int("sample-rate", 0, "audio sample rate in Hz (required)")
	sttCreateSessionCmd.Flags().String("provider", "", "STT provider: soniox or deepgram")
	sttCreateSessionCmd.Flags().String("language", "", "language code for transcription")
	sttCreateSessionCmd.Flags().String("model", "", "STT model")

	sttCmd.AddCommand(sttCreateSessionCmd)
	rootCmd.AddCommand(sttCmd)
}
