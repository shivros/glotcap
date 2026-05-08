package cmd

import (
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"
)

var ttsCmd = &cobra.Command{
	Use:   "tts",
	Short: "Text-to-speech synthesis",
	Long:  `Synthesize speech from text and stream audio output.`,
}

var ttsSynthesizeCmd = &cobra.Command{
	Use:   "synthesize",
	Short: "Synthesize speech from text",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		text, _ := cmd.Flags().GetString("text")
		language, _ := cmd.Flags().GetString("language")
		voice, _ := cmd.Flags().GetString("voice")
		if text == "" {
			return fmt.Errorf("--text is required")
		}
		cmdArgs := map[string]any{
			"text": text,
		}
		if language != "" {
			cmdArgs["language"] = language
		}
		if voice != "" {
			cmdArgs["voice"] = voice
		}
		val, err := client.Action(cmd.Context(), "tts:synthesize", cmdArgs)
		return printResult(val, err, "synthesizing speech")
	},
}

var ttsStreamCmd = &cobra.Command{
	Use:   "stream",
	Short: "Stream text-to-speech audio",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		text, _ := cmd.Flags().GetString("text")
		language, _ := cmd.Flags().GetString("language")
		voice, _ := cmd.Flags().GetString("voice")
		if text == "" {
			return fmt.Errorf("--text is required")
		}
		cmdArgs := map[string]any{
			"text": text,
		}
		if language != "" {
			cmdArgs["language"] = language
		}
		if voice != "" {
			cmdArgs["voice"] = voice
		}
		stream, err := client.ActionStream(cmd.Context(), "tts:stream", cmdArgs)
		if err != nil {
			return fmt.Errorf("streaming TTS: %w", err)
		}
		defer stream.Close()

		if _, err := io.Copy(os.Stdout, stream); err != nil {
			return fmt.Errorf("reading TTS stream: %w", err)
		}
		return nil
	},
}

func init() {
	ttsSynthesizeCmd.Flags().String("text", "", "text to synthesize (required)")
	ttsSynthesizeCmd.Flags().String("language", "", "language code")
	ttsSynthesizeCmd.Flags().String("voice", "", "voice ID or name")

	ttsStreamCmd.Flags().String("text", "", "text to stream (required)")
	ttsStreamCmd.Flags().String("language", "", "language code")
	ttsStreamCmd.Flags().String("voice", "", "voice ID or name")

	ttsCmd.AddCommand(ttsSynthesizeCmd)
	ttsCmd.AddCommand(ttsStreamCmd)
	rootCmd.AddCommand(ttsCmd)
}
