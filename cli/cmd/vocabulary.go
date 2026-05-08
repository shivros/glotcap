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
	Use:   "analyze",
	Short: "Analyze text for vocabulary items",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		text, _ := cmd.Flags().GetString("text")
		language, _ := cmd.Flags().GetString("language")
		if text == "" {
			return fmt.Errorf("--text is required")
		}
		cmdArgs := map[string]any{
			"text": text,
		}
		if language != "" {
			cmdArgs["language"] = language
		}
		val, err := client.Action(cmd.Context(), "vocabulary:analyze", cmdArgs)
		return printResult(val, err, "analyzing vocabulary")
	},
}

func init() {
	vocabularyAnalyzeCmd.Flags().String("text", "", "text to analyze for vocabulary (required)")
	vocabularyAnalyzeCmd.Flags().String("language", "", "language code of the text")

	vocabularyCmd.AddCommand(vocabularyAnalyzeCmd)
	rootCmd.AddCommand(vocabularyCmd)
}
