package cmd

import (

	"github.com/spf13/cobra"
)

var sttCmd = &cobra.Command{
	Use:   "stt",
	Short: "Speech-to-text session management",
	Long:  `Create and manage speech-to-text transcription sessions.`,
}

var sttCreateSessionCmd = &cobra.Command{
	Use:   "create-session",
	Short: "Create a new STT session",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		language, _ := cmd.Flags().GetString("language")
		sampleRate, _ := cmd.Flags().GetInt("sample-rate")
		cmdArgs := map[string]any{}
		if language != "" {
			cmdArgs["language"] = language
		}
		if sampleRate > 0 {
			cmdArgs["sampleRate"] = sampleRate
		}
		val, err := client.Action(cmd.Context(), "stt:createSession", cmdArgs)
		return printResult(val, err, "creating STT session")
	},
}

func init() {
	sttCreateSessionCmd.Flags().String("language", "", "language code for transcription")
	sttCreateSessionCmd.Flags().Int("sample-rate", 0, "audio sample rate in Hz")

	sttCmd.AddCommand(sttCreateSessionCmd)
	rootCmd.AddCommand(sttCmd)
}
