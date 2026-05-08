package cmd

import (

	"github.com/spf13/cobra"
)

var insightsCmd = &cobra.Command{
	Use:   "insights",
	Short: "View and manage learning insights",
	Long:  `List insights, view session details, manage insight examples, and reject/restore items.`,
}

var insightsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List learning insights",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		limit, _ := cmd.Flags().GetInt("limit")
		cursor, _ := cmd.Flags().GetString("cursor")
		typeFilter, _ := cmd.Flags().GetString("type")
		cmdArgs := map[string]any{}
		if limit > 0 {
			cmdArgs["limit"] = limit
		}
		if cursor != "" {
			cmdArgs["cursor"] = cursor
		}
		if typeFilter != "" {
			cmdArgs["type"] = typeFilter
		}
		val, err := client.Query(cmd.Context(), "insights:list", cmdArgs)
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
		val, err := client.Query(cmd.Context(), "insights:getSessionInsights", map[string]any{
			"sessionId": args[0],
		})
		return printResult(val, err, "getting session insights")
	},
}

var insightsExamplesCmd = &cobra.Command{
	Use:   "examples <insightId>",
	Short: "Get examples for a specific insight",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "insights:getExamples", map[string]any{
			"insightId": args[0],
		})
		return printResult(val, err, "getting insight examples")
	},
}

var insightsRejectCmd = &cobra.Command{
	Use:   "reject <insightId>",
	Short: "Reject an insight",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "insights:reject", map[string]any{
			"insightId": args[0],
		})
		return printResult(val, err, "rejecting insight")
	},
}

var insightsRestoreCmd = &cobra.Command{
	Use:   "restore <insightId>",
	Short: "Restore a previously rejected insight",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "insights:restore", map[string]any{
			"insightId": args[0],
		})
		return printResult(val, err, "restoring insight")
	},
}

var insightsRejectExampleCmd = &cobra.Command{
	Use:   "reject-example <exampleId>",
	Short: "Reject a specific insight example",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "insights:rejectExample", map[string]any{
			"exampleId": args[0],
		})
		return printResult(val, err, "rejecting example")
	},
}

var insightsRestoreExampleCmd = &cobra.Command{
	Use:   "restore-example <exampleId>",
	Short: "Restore a previously rejected insight example",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "insights:restoreExample", map[string]any{
			"exampleId": args[0],
		})
		return printResult(val, err, "restoring example")
	},
}

func init() {
	insightsListCmd.Flags().Int("limit", 0, "max number of insights to return")
	insightsListCmd.Flags().String("cursor", "", "pagination cursor")
	insightsListCmd.Flags().String("type", "", "filter by insight type")

	insightsCmd.AddCommand(insightsListCmd)
	insightsCmd.AddCommand(insightsSessionCmd)
	insightsCmd.AddCommand(insightsExamplesCmd)
	insightsCmd.AddCommand(insightsRejectCmd)
	insightsCmd.AddCommand(insightsRestoreCmd)
	insightsCmd.AddCommand(insightsRejectExampleCmd)
	insightsCmd.AddCommand(insightsRestoreExampleCmd)
	rootCmd.AddCommand(insightsCmd)
}
