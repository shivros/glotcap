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
			"text":           text,
			"targetLanguage": to,
		}
		if from != "" {
			cmdArgs["sourceLanguage"] = from
		}
		model, _ := cmd.Flags().GetString("model")
		if model != "" {
			cmdArgs["model"] = model
		}
		sessionId, _ := cmd.Flags().GetString("session-id")
		if sessionId != "" {
			cmdArgs["sessionId"] = sessionId
		}
		sourceId, _ := cmd.Flags().GetString("source-id")
		if sourceId != "" {
			cmdArgs["sourceId"] = sourceId
		}
		reason, _ := cmd.Flags().GetString("reason")
		if reason != "" {
			cmdArgs["reason"] = reason
		}
	if cmd.Flags().Changed("revision") {
		revision, _ := cmd.Flags().GetInt("revision")
		cmdArgs["revision"] = revision
	}
		val, err := client.Action(cmd.Context(), "translations:translateSegment", cmdArgs)
		return printResult(val, err, "translating text")
	},
}

func init() {
	translationsTranslateCmd.Flags().String("text", "", "text to translate (required)")
	translationsTranslateCmd.Flags().String("from", "", "source language code (auto-detected if omitted)")
	translationsTranslateCmd.Flags().String("to", "", "target language code (required)")
	translationsTranslateCmd.Flags().String("model", "", "translation model to use")
	translationsTranslateCmd.Flags().String("session-id", "", "associated speaking session ID")
	translationsTranslateCmd.Flags().String("source-id", "", "source event ID")
	translationsTranslateCmd.Flags().String("reason", "", "translation reason: timer, immediate, or force")
	translationsTranslateCmd.Flags().Int("revision", 0, "translation revision number")

	translationsCmd.AddCommand(translationsTranslateCmd)
	rootCmd.AddCommand(translationsCmd)
}
