package cmd

import (
	"fmt"

	"github.com/google/uuid"
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
		language, _ := cmd.Flags().GetString("language")
		topic, _ := cmd.Flags().GetString("topic")
		level, _ := cmd.Flags().GetString("level")
		mode, _ := cmd.Flags().GetString("mode")

		cmdArgs := map[string]any{
			"requestId": uuid.New().String(),
		}
		if language != "" {
			cmdArgs["language"] = language
		}
		if topic != "" {
			cmdArgs["topic"] = topic
		}
		if level != "" {
			cmdArgs["level"] = level
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
		val, err := client.Mutation(cmd.Context(), "speaking:endSession", map[string]any{
			"sessionId": args[0],
			"requestId": uuid.New().String(),
		})
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
			"requestId": uuid.New().String(),
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
			"requestId": uuid.New().String(),
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
		cursor, _ := cmd.Flags().GetString("cursor")
		cmdArgs := map[string]any{}
		if limit > 0 {
			cmdArgs["limit"] = limit
		}
		if cursor != "" {
			cmdArgs["cursor"] = cursor
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
		val, err := client.Query(cmd.Context(), "speaking:getSessionTranscript", map[string]any{
			"sessionId": args[0],
		})
		return printResult(val, err, "getting transcript")
	},
}

var speakingFeedCmd = &cobra.Command{
	Use:   "feed",
	Short: "Get the speaking session feed",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		limit, _ := cmd.Flags().GetInt("limit")
		cursor, _ := cmd.Flags().GetString("cursor")
		cmdArgs := map[string]any{}
		if limit > 0 {
			cmdArgs["limit"] = limit
		}
		if cursor != "" {
			cmdArgs["cursor"] = cursor
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

func init() {
	speakingStartCmd.Flags().String("language", "", "target language code (e.g. 'es', 'fr')")
	speakingStartCmd.Flags().String("topic", "", "conversation topic")
	speakingStartCmd.Flags().String("level", "", "proficiency level (e.g. 'beginner', 'intermediate')")
	speakingStartCmd.Flags().String("mode", "", "session mode (e.g. 'conversation', 'drill')")

	speakingListCmd.Flags().Int("limit", 0, "max number of sessions to return")
	speakingListCmd.Flags().String("cursor", "", "pagination cursor")

	speakingFeedCmd.Flags().Int("limit", 0, "max number of items to return")
	speakingFeedCmd.Flags().String("cursor", "", "pagination cursor")

	speakingSetTurnCmd.Flags().String("turn-id", "", "turn ID (required)")

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
	rootCmd.AddCommand(speakingCmd)
}
