package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var insightsCmd = &cobra.Command{
	Use:   "insights",
	Short: "View and manage learning insights",
	Long:  `List insights, view session details, manage insight examples, and reject/restore items.`,
}

var insightsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List learning insights for a language",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		language, _ := cmd.Flags().GetString("language")
		if language == "" {
			return fmt.Errorf("--language is required")
		}
		cmdArgs := map[string]any{
			"language": language,
		}
		halfLifeDays, _ := cmd.Flags().GetInt("half-life-days")
		if cmd.Flags().Changed("half-life-days") {
			cmdArgs["halfLifeDays"] = halfLifeDays
		}
		includeRejected, _ := cmd.Flags().GetBool("include-rejected")
		if includeRejected {
			cmdArgs["includeRejected"] = true
		}
		val, err := client.Query(cmd.Context(), "learningInsights:listLearningInsights", cmdArgs)
		return printResult(val, err, "listing insights")
	},
}

var insightsSessionCmd = &cobra.Command{
	Use:   "session <sessionId>",
	Short: "Get insights for a specific session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "learningInsights:listSessionInsights", map[string]any{
			"sessionId": args[0],
		})
		return printResult(val, err, "getting session insights")
	},
}

var insightsExamplesCmd = &cobra.Command{
	Use:   "examples",
	Short: "Get examples for a specific learning insight",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		language, _ := cmd.Flags().GetString("language")
		if language == "" {
			return fmt.Errorf("--language is required")
		}
		canonicalKey, _ := cmd.Flags().GetString("canonical-key")
		if canonicalKey == "" {
			return fmt.Errorf("--canonical-key is required")
		}
		cmdArgs := map[string]any{
			"language":     language,
			"canonicalKey": canonicalKey,
		}
		page, _ := cmd.Flags().GetInt("page")
		if cmd.Flags().Changed("page") {
			cmdArgs["page"] = page
		}
		pageSize, _ := cmd.Flags().GetInt("page-size")
		if cmd.Flags().Changed("page-size") {
			cmdArgs["pageSize"] = pageSize
		}
		includeRejected, _ := cmd.Flags().GetBool("include-rejected")
		if includeRejected {
			cmdArgs["includeRejected"] = true
		}
		val, err := client.Query(cmd.Context(), "learningInsights:listLearningInsightExamples", cmdArgs)
		return printResult(val, err, "getting insight examples")
	},
}

var insightsRejectCmd = &cobra.Command{
	Use:   "reject",
	Short: "Reject a learning insight",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		language, _ := cmd.Flags().GetString("language")
		if language == "" {
			return fmt.Errorf("--language is required")
		}
		canonical, _ := cmd.Flags().GetString("canonical")
		if canonical == "" {
			return fmt.Errorf("--canonical is required")
		}
		canonicalKey, _ := cmd.Flags().GetString("canonical-key")
		if canonicalKey == "" {
			return fmt.Errorf("--canonical-key is required")
		}
		cmdArgs := map[string]any{
			"language":     language,
			"canonical":    canonical,
			"canonicalKey": canonicalKey,
		}
		category, _ := cmd.Flags().GetString("category")
		if category != "" {
			cmdArgs["category"] = category
		}
		reason, _ := cmd.Flags().GetString("reason")
		if reason != "" {
			cmdArgs["reason"] = reason
		}
		val, err := client.Mutation(cmd.Context(), "learningInsights:rejectLearningInsight", cmdArgs)
		return printResult(val, err, "rejecting insight")
	},
}

var insightsRestoreCmd = &cobra.Command{
	Use:   "restore",
	Short: "Restore a previously rejected insight",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		language, _ := cmd.Flags().GetString("language")
		if language == "" {
			return fmt.Errorf("--language is required")
		}
		canonicalKey, _ := cmd.Flags().GetString("canonical-key")
		if canonicalKey == "" {
			return fmt.Errorf("--canonical-key is required")
		}
		val, err := client.Mutation(cmd.Context(), "learningInsights:restoreLearningInsight", map[string]any{
			"language":     language,
			"canonicalKey": canonicalKey,
		})
		return printResult(val, err, "restoring insight")
	},
}

var insightsRejectExampleCmd = &cobra.Command{
	Use:   "reject-example <correctionId>",
	Short: "Reject a specific insight example",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		language, _ := cmd.Flags().GetString("language")
		if language == "" {
			return fmt.Errorf("--language is required")
		}
		cmdArgs := map[string]any{
			"language":     language,
			"correctionId": args[0],
		}
		reason, _ := cmd.Flags().GetString("reason")
		if reason != "" {
			cmdArgs["reason"] = reason
		}
		val, err := client.Mutation(cmd.Context(), "learningInsights:rejectLearningInsightExample", cmdArgs)
		return printResult(val, err, "rejecting example")
	},
}

var insightsRestoreExampleCmd = &cobra.Command{
	Use:   "restore-example <correctionId>",
	Short: "Restore a previously rejected insight example",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		language, _ := cmd.Flags().GetString("language")
		if language == "" {
			return fmt.Errorf("--language is required")
		}
		val, err := client.Mutation(cmd.Context(), "learningInsights:restoreLearningInsightExample", map[string]any{
			"language":     language,
			"correctionId": args[0],
		})
		return printResult(val, err, "restoring example")
	},
}

func init() {
	insightsListCmd.Flags().String("language", "", "language code (required)")
	insightsListCmd.Flags().Int("half-life-days", 0, "half-life in days for scoring (default 30)")
	insightsListCmd.Flags().Bool("include-rejected", false, "include rejected insights")

	insightsExamplesCmd.Flags().String("language", "", "language code (required)")
	insightsExamplesCmd.Flags().String("canonical-key", "", "canonical key of the insight (required)")
	insightsExamplesCmd.Flags().Int("page", 0, "page number")
	insightsExamplesCmd.Flags().Int("page-size", 0, "page size")
	insightsExamplesCmd.Flags().Bool("include-rejected", false, "include rejected examples")

	insightsRejectCmd.Flags().String("language", "", "language code (required)")
	insightsRejectCmd.Flags().String("canonical", "", "canonical form of the insight (required)")
	insightsRejectCmd.Flags().String("canonical-key", "", "canonical key of the insight (required)")
	insightsRejectCmd.Flags().String("category", "", "insight category")
	insightsRejectCmd.Flags().String("reason", "", "reason for rejection")

	insightsRestoreCmd.Flags().String("language", "", "language code (required)")
	insightsRestoreCmd.Flags().String("canonical-key", "", "canonical key of the insight (required)")

	insightsRejectExampleCmd.Flags().String("language", "", "language code (required)")
	insightsRejectExampleCmd.Flags().String("reason", "", "reason for rejection")

	insightsRestoreExampleCmd.Flags().String("language", "", "language code (required)")

	insightsCmd.AddCommand(insightsListCmd)
	insightsCmd.AddCommand(insightsSessionCmd)
	insightsCmd.AddCommand(insightsExamplesCmd)
	insightsCmd.AddCommand(insightsRejectCmd)
	insightsCmd.AddCommand(insightsRestoreCmd)
	insightsCmd.AddCommand(insightsRejectExampleCmd)
	insightsCmd.AddCommand(insightsRestoreExampleCmd)
	rootCmd.AddCommand(insightsCmd)
}
