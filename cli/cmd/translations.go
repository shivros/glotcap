package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var translationsCmd = &cobra.Command{
	Use:   "translations",
	Short: "Translate text between languages",
	Long:  `Translate text from one language to another using the GlotCap translation engine.`,
}

var translationsTranslateCmd = &cobra.Command{
	Use:   "translate",
	Short: "Translate text",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		text, _ := cmd.Flags().GetString("text")
		from, _ := cmd.Flags().GetString("from")
		to, _ := cmd.Flags().GetString("to")
		if text == "" {
			return fmt.Errorf("--text is required")
		}
		if to == "" {
			return fmt.Errorf("--to (target language) is required")
		}
		cmdArgs := map[string]any{
			"text": text,
			"targetLanguage": to,
		}
		if from != "" {
			cmdArgs["sourceLanguage"] = from
		}
		val, err := client.Action(cmd.Context(), "translations:translateSegment", cmdArgs)
		return printResult(val, err, "translating text")
	},
}

func init() {
	translationsTranslateCmd.Flags().String("text", "", "text to translate (required)")
	translationsTranslateCmd.Flags().String("from", "", "source language code (auto-detected if omitted)")
	translationsTranslateCmd.Flags().String("to", "", "target language code (required)")

	translationsCmd.AddCommand(translationsTranslateCmd)
	rootCmd.AddCommand(translationsCmd)
}
