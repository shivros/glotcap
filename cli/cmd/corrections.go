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
	Use:   "analyze <sessionId>",
	Short: "Analyze text for corrections in a session",
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
		model, _ := cmd.Flags().GetString("model")
		if model != "" {
			cmdArgs["model"] = model
		}
		temperature, _ := cmd.Flags().GetFloat64("temperature")
		if cmd.Flags().Changed("temperature") {
			cmdArgs["temperature"] = temperature
		}
		maxCorrections, _ := cmd.Flags().GetInt("max-corrections")
		if maxCorrections > 0 {
			cmdArgs["maxCorrections"] = maxCorrections
		}
		val, err := client.Action(cmd.Context(), "corrections:analyzeTurn", cmdArgs)
		return printResult(val, err, "analyzing corrections")
	},
}

func init() {
	correctionsAnalyzeCmd.Flags().String("text", "", "text to analyze for corrections (required)")
	correctionsAnalyzeCmd.Flags().String("transcript-event-id", "", "ID of the associated transcript event")
	correctionsAnalyzeCmd.Flags().String("model", "", "model to use for analysis")
	correctionsAnalyzeCmd.Flags().Float64("temperature", 0, "model temperature")
	correctionsAnalyzeCmd.Flags().Int("max-corrections", 0, "maximum number of corrections to return")

	correctionsCmd.AddCommand(correctionsAnalyzeCmd)
	rootCmd.AddCommand(correctionsCmd)
}
