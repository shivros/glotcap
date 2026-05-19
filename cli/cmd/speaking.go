package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var speakingCmd = &cobra.Command{
	Use:   "speaking",
	Short: "Manage speaking sessions",
	Long:  `Start, end, pause, resume, list, and query speaking practice sessions.`,
}

var speakingStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start a new speaking session",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		targetLanguage, _ := cmd.Flags().GetString("target-language")
		if targetLanguage == "" {
			return fmt.Errorf("--target-language is required")
		}
		sourceLanguage, _ := cmd.Flags().GetString("source-language")
		demoId, _ := cmd.Flags().GetString("demo-id")
		limitMs, _ := cmd.Flags().GetInt("limit-ms")
		turnId, _ := cmd.Flags().GetString("turn-id")
		mode, _ := cmd.Flags().GetString("mode")

		cmdArgs := map[string]any{
			"targetLanguage": targetLanguage,
		}
		if sourceLanguage != "" {
			cmdArgs["sourceLanguage"] = sourceLanguage
		}
		if demoId != "" {
			cmdArgs["demoId"] = demoId
		}
		if cmd.Flags().Changed("limit-ms") {
			cmdArgs["limitMs"] = limitMs
		}
		if turnId != "" {
			cmdArgs["turnId"] = turnId
		}
		if mode != "" {
			cmdArgs["mode"] = mode
		}

		val, err := client.Mutation(cmd.Context(), "speaking:startSession", cmdArgs)
		return printResult(val, err, "starting speaking session")
	},
}

var speakingEndCmd = &cobra.Command{
	Use:   "end <sessionId>",
	Short: "End a speaking session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		cmdArgs := map[string]any{
			"sessionId": args[0],
		}
		terminationReason, _ := cmd.Flags().GetString("termination-reason")
		if terminationReason != "" {
			cmdArgs["terminationReason"] = terminationReason
		}
		val, err := client.Mutation(cmd.Context(), "speaking:endSession", cmdArgs)
		return printResult(val, err, "ending speaking session")
	},
}

var speakingPauseCmd = &cobra.Command{
	Use:   "pause <sessionId>",
	Short: "Pause a speaking session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "speaking:pauseSession", map[string]any{
			"sessionId": args[0],
		})
		return printResult(val, err, "pausing speaking session")
	},
}

var speakingResumeCmd = &cobra.Command{
	Use:   "resume <sessionId>",
	Short: "Resume a paused speaking session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "speaking:resumeSession", map[string]any{
			"sessionId": args[0],
		})
		return printResult(val, err, "resuming speaking session")
	},
}

var speakingGetCmd = &cobra.Command{
	Use:   "get <sessionId>",
	Short: "Get details for a specific speaking session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "speaking:getSession", map[string]any{
			"sessionId": args[0],
		})
		return printResult(val, err, "getting speaking session")
	},
}

var speakingListCmd = &cobra.Command{
	Use:   "list",
	Short: "List speaking sessions",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		limit, _ := cmd.Flags().GetInt("limit")
		cmdArgs := map[string]any{}
		if cmd.Flags().Changed("limit") {
			cmdArgs["limit"] = limit
		}
		val, err := client.Query(cmd.Context(), "speaking:listRecentSessions", cmdArgs)
		return printResult(val, err, "listing speaking sessions")
	},
}

var speakingTranscriptCmd = &cobra.Command{
	Use:   "transcript <sessionId>",
	Short: "Get the transcript for a speaking session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		limit, _ := cmd.Flags().GetInt("limit")
		cmdArgs := map[string]any{
			"sessionId": args[0],
		}
		if cmd.Flags().Changed("limit") {
			cmdArgs["limit"] = limit
		}
		val, err := client.Query(cmd.Context(), "speaking:getSessionTranscript", cmdArgs)
		return printResult(val, err, "getting transcript")
	},
}

var speakingFeedCmd = &cobra.Command{
	Use:   "feed <sessionId>",
	Short: "Get the speaking session event feed",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		limit, _ := cmd.Flags().GetInt("limit")
		cmdArgs := map[string]any{
			"sessionId": args[0],
		}
		if cmd.Flags().Changed("limit") {
			cmdArgs["limit"] = limit
		}
		val, err := client.Query(cmd.Context(), "speaking:getSessionFeed", cmdArgs)
		return printResult(val, err, "getting speaking feed")
	},
}

var speakingUsageCmd = &cobra.Command{
	Use:   "usage <sessionId>",
	Short: "Get speaking usage statistics for a session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "speaking:getSessionUsage", map[string]any{"sessionId": args[0]})
		return printResult(val, err, "getting usage")
	},
}

var speakingDailyUsageCmd = &cobra.Command{
	Use:   "daily-usage",
	Short: "Get daily speaking usage",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "speaking:getDailyUsage", map[string]any{})
		return printResult(val, err, "getting daily usage")
	},
}

var speakingDemoLimitCmd = &cobra.Command{
	Use:   "demo-limit",
	Short: "Check demo usage limits",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "speaking:getDemoLimit", map[string]any{})
		return printResult(val, err, "getting demo limit")
	},
}

var speakingSetTurnCmd = &cobra.Command{
	Use:   "set-turn <sessionId>",
	Short: "Set the current turn in a speaking session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		turnID, _ := cmd.Flags().GetString("turn-id")
		if turnID == "" {
			return fmt.Errorf("--turn-id is required")
		}
		val, err := client.Mutation(cmd.Context(), "speaking:setActiveTurnId", map[string]any{
			"sessionId": args[0],
			"turnId":    turnID,
		})
		return printResult(val, err, "setting turn")
	},
}

var speakingRecordUsageCmd = &cobra.Command{
	Use:   "record-usage <sessionId>",
	Short: "Record usage time for a speaking session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		deltaMs, _ := cmd.Flags().GetInt("delta-ms")
		if deltaMs <= 0 {
			return fmt.Errorf("--delta-ms is required and must be > 0")
		}
		val, err := client.Mutation(cmd.Context(), "speaking:recordUsage", map[string]any{
			"sessionId": args[0],
			"deltaMs":   deltaMs,
		})
		return printResult(val, err, "recording usage")
	},
}

func init() {
	speakingStartCmd.Flags().String("target-language", "", "target language code (e.g. 'es', 'fr') (required)")
	speakingStartCmd.Flags().String("source-language", "", "source language code")
	speakingStartCmd.Flags().String("demo-id", "", "demo session ID")
	speakingStartCmd.Flags().Int("limit-ms", 0, "session time limit in milliseconds")
	speakingStartCmd.Flags().String("turn-id", "", "initial turn ID")
	speakingStartCmd.Flags().String("mode", "", "session mode: 'demo' or 'standard'")

	speakingEndCmd.Flags().String("termination-reason", "", "termination reason: 'manual', 'limit_reached', or 'error'")

	speakingListCmd.Flags().Int("limit", 0, "max number of sessions to return")

	speakingTranscriptCmd.Flags().Int("limit", 0, "max number of transcript entries (default 200)")

	speakingFeedCmd.Flags().Int("limit", 0, "max number of feed items (default 60)")

	speakingSetTurnCmd.Flags().String("turn-id", "", "turn ID (required)")

	speakingRecordUsageCmd.Flags().Int("delta-ms", 0, "usage delta in milliseconds (required)")

	speakingCmd.AddCommand(speakingStartCmd)
	speakingCmd.AddCommand(speakingEndCmd)
	speakingCmd.AddCommand(speakingPauseCmd)
	speakingCmd.AddCommand(speakingResumeCmd)
	speakingCmd.AddCommand(speakingGetCmd)
	speakingCmd.AddCommand(speakingListCmd)
	speakingCmd.AddCommand(speakingTranscriptCmd)
	speakingCmd.AddCommand(speakingFeedCmd)
	speakingCmd.AddCommand(speakingUsageCmd)
	speakingCmd.AddCommand(speakingDailyUsageCmd)
	speakingCmd.AddCommand(speakingDemoLimitCmd)
	speakingCmd.AddCommand(speakingSetTurnCmd)
	speakingCmd.AddCommand(speakingRecordUsageCmd)
	rootCmd.AddCommand(speakingCmd)
}
