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
		if text == "" {
			return fmt.Errorf("--text is required")
		}
		cmdArgs := map[string]any{
			"text": text,
		}
		provider, _ := cmd.Flags().GetString("provider")
		if provider != "" {
			cmdArgs["provider"] = provider
		}
		voiceId, _ := cmd.Flags().GetString("voice-id")
		if voiceId != "" {
			cmdArgs["voiceId"] = voiceId
		}
		modelId, _ := cmd.Flags().GetString("model-id")
		if modelId != "" {
			cmdArgs["modelId"] = modelId
		}
		languageCode, _ := cmd.Flags().GetString("language-code")
		if languageCode != "" {
			cmdArgs["languageCode"] = languageCode
		}
		outputFormat, _ := cmd.Flags().GetString("output-format")
		if outputFormat != "" {
			cmdArgs["outputFormat"] = outputFormat
		}
		sampleRateHertz, _ := cmd.Flags().GetInt("sample-rate-hertz")
		if cmd.Flags().Changed("sample-rate-hertz") {
			cmdArgs["sampleRateHertz"] = sampleRateHertz
		}
		prompt, _ := cmd.Flags().GetString("prompt")
		if prompt != "" {
			cmdArgs["prompt"] = prompt
		}
		optimizeStreamingLatency, _ := cmd.Flags().GetInt("optimize-streaming-latency")
		if cmd.Flags().Changed("optimize-streaming-latency") {
			cmdArgs["optimizeStreamingLatency"] = optimizeStreamingLatency
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
		if text == "" {
			return fmt.Errorf("--text is required")
		}
		cmdArgs := map[string]any{
			"text": text,
		}
		provider, _ := cmd.Flags().GetString("provider")
		if provider != "" {
			cmdArgs["provider"] = provider
		}
		voiceId, _ := cmd.Flags().GetString("voice-id")
		if voiceId != "" {
			cmdArgs["voiceId"] = voiceId
		}
		modelId, _ := cmd.Flags().GetString("model-id")
		if modelId != "" {
			cmdArgs["modelId"] = modelId
		}
		languageCode, _ := cmd.Flags().GetString("language-code")
		if languageCode != "" {
			cmdArgs["languageCode"] = languageCode
		}
		outputFormat, _ := cmd.Flags().GetString("output-format")
		if outputFormat != "" {
			cmdArgs["outputFormat"] = outputFormat
		}
		sampleRateHertz, _ := cmd.Flags().GetInt("sample-rate-hertz")
		if cmd.Flags().Changed("sample-rate-hertz") {
			cmdArgs["sampleRateHertz"] = sampleRateHertz
		}
		prompt, _ := cmd.Flags().GetString("prompt")
		if prompt != "" {
			cmdArgs["prompt"] = prompt
		}
		optimizeStreamingLatency, _ := cmd.Flags().GetInt("optimize-streaming-latency")
		if cmd.Flags().Changed("optimize-streaming-latency") {
			cmdArgs["optimizeStreamingLatency"] = optimizeStreamingLatency
		}
		stream, err := client.HTTPStream(cmd.Context(), "/tts-stream", cmdArgs)
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
	ttsSynthesizeCmd.Flags().String("provider", "", "TTS provider: elevenlabs, google_cloud_tts, or vertex_gemini_tts")
	ttsSynthesizeCmd.Flags().String("voice-id", "", "voice ID")
	ttsSynthesizeCmd.Flags().String("model-id", "", "model ID")
	ttsSynthesizeCmd.Flags().String("language-code", "", "language code (e.g. 'es-ES')")
	ttsSynthesizeCmd.Flags().String("output-format", "", "output audio format")
	ttsSynthesizeCmd.Flags().Int("sample-rate-hertz", 0, "audio sample rate in Hz")
	ttsSynthesizeCmd.Flags().String("prompt", "", "TTS prompt")
	ttsSynthesizeCmd.Flags().Int("optimize-streaming-latency", 0, "streaming latency optimization level")

	ttsStreamCmd.Flags().String("text", "", "text to stream (required)")
	ttsStreamCmd.Flags().String("provider", "", "TTS provider: elevenlabs, google_cloud_tts, or vertex_gemini_tts")
	ttsStreamCmd.Flags().String("voice-id", "", "voice ID")
	ttsStreamCmd.Flags().String("model-id", "", "model ID")
	ttsStreamCmd.Flags().String("language-code", "", "language code (e.g. 'es-ES')")
	ttsStreamCmd.Flags().String("output-format", "", "output audio format")
	ttsStreamCmd.Flags().Int("sample-rate-hertz", 0, "audio sample rate in Hz")
	ttsStreamCmd.Flags().String("prompt", "", "TTS prompt")
	ttsStreamCmd.Flags().Int("optimize-streaming-latency", 0, "streaming latency optimization level")

	ttsCmd.AddCommand(ttsSynthesizeCmd)
	ttsCmd.AddCommand(ttsStreamCmd)
	rootCmd.AddCommand(ttsCmd)
}
