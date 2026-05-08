package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var correctionsCmd = &cobra.Command{
	Use:   "corrections",
	Short: "Analyze text for corrections",
	Long:  `Analyze text to identify grammar, spelling, and usage corrections.`,
}

var correctionsAnalyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "Analyze text for corrections",
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
		val, err := client.Action(cmd.Context(), "corrections:analyze", cmdArgs)
		return printResult(val, err, "analyzing corrections")
	},
}

func init() {
	correctionsAnalyzeCmd.Flags().String("text", "", "text to analyze for corrections (required)")
	correctionsAnalyzeCmd.Flags().String("language", "", "language code of the text")

	correctionsCmd.AddCommand(correctionsAnalyzeCmd)
	rootCmd.AddCommand(correctionsCmd)
}
