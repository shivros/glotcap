package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var vocabularyCmd = &cobra.Command{
	Use:   "vocabulary",
	Short: "Analyze text for vocabulary",
	Long:  `Analyze text to extract vocabulary items, definitions, and usage notes.`,
}

var vocabularyAnalyzeCmd = &cobra.Command{
	Use:   "analyze <sessionId>",
	Short: "Analyze text for vocabulary items in a session",
	Args:  cobra.ExactArgs(1),
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
			"sessionId": args[0],
			"text":      text,
		}
		transcriptEventId, _ := cmd.Flags().GetString("transcript-event-id")
		if transcriptEventId != "" {
			cmdArgs["transcriptEventId"] = transcriptEventId
		}
		excludeText, _ := cmd.Flags().GetString("exclude-text")
		if excludeText != "" {
			cmdArgs["excludeText"] = excludeText
		}
		model, _ := cmd.Flags().GetString("model")
		if model != "" {
			cmdArgs["model"] = model
		}
		temperature, _ := cmd.Flags().GetFloat64("temperature")
		if cmd.Flags().Changed("temperature") {
			cmdArgs["temperature"] = temperature
		}
		maxVocabulary, _ := cmd.Flags().GetInt("max-vocabulary")
		if maxVocabulary > 0 {
			cmdArgs["maxVocabulary"] = maxVocabulary
		}
		val, err := client.Action(cmd.Context(), "vocabulary:analyzeTurn", cmdArgs)
		return printResult(val, err, "analyzing vocabulary")
	},
}

func init() {
	vocabularyAnalyzeCmd.Flags().String("text", "", "text to analyze for vocabulary (required)")
	vocabularyAnalyzeCmd.Flags().String("transcript-event-id", "", "ID of the associated transcript event")
	vocabularyAnalyzeCmd.Flags().String("exclude-text", "", "text to exclude from vocabulary extraction")
	vocabularyAnalyzeCmd.Flags().String("model", "", "model to use for analysis")
	vocabularyAnalyzeCmd.Flags().Float64("temperature", 0, "model temperature")
	vocabularyAnalyzeCmd.Flags().Int("max-vocabulary", 0, "maximum number of vocabulary items to return")

	vocabularyCmd.AddCommand(vocabularyAnalyzeCmd)
	rootCmd.AddCommand(vocabularyCmd)
}
