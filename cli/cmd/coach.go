package cmd

import (
	"fmt"
	"io"
	"os"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

var coachCmd = &cobra.Command{
	Use:   "coach",
	Short: "Interact with the AI speaking coach",
	Long:  `Stream responses from the AI coach, manage conversation turns.`,
}

var coachStreamStartCmd = &cobra.Command{
	Use:   "stream-start <sessionId>",
	Short: "Start a coach streaming response",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		message, _ := cmd.Flags().GetString("message")
		contextJSON, _ := cmd.Flags().GetString("context")

		cmdArgs := map[string]any{
			"sessionId": args[0],
			"requestId": uuid.New().String(),
		}
		if message != "" {
			cmdArgs["message"] = message
		}
		if contextJSON != "" {
			var ctxData map[string]any
			if err := parseJSONArg(contextJSON, &ctxData); err != nil {
				return fmt.Errorf("--context must be valid JSON: %w", err)
			}
			cmdArgs["context"] = ctxData
		}

		stream, err := client.ActionStream(cmd.Context(), "coach:streamStart", cmdArgs)
		if err != nil {
			return fmt.Errorf("starting coach stream: %w", err)
		}
		defer stream.Close()

		if _, err := io.Copy(os.Stdout, stream); err != nil {
			return fmt.Errorf("reading coach stream: %w", err)
		}
		return nil
	},
}

var coachStreamCancelCmd = &cobra.Command{
	Use:   "stream-cancel <sessionId>",
	Short: "Cancel an active coach stream",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "coach:streamCancel", map[string]any{
			"sessionId": args[0],
			"requestId": uuid.New().String(),
		})
		return printResult(val, err, "canceling coach stream")
	},
}

var coachStreamReplyCmd = &cobra.Command{
	Use:   "stream-reply <sessionId>",
	Short: "Send a reply in the coach conversation stream",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		message, _ := cmd.Flags().GetString("message")
		if message == "" {
			return fmt.Errorf("--message is required")
		}

		stream, err := client.ActionStream(cmd.Context(), "coach:streamReply", map[string]any{
			"sessionId": args[0],
			"message":   message,
			"requestId": uuid.New().String(),
		})
		if err != nil {
			return fmt.Errorf("sending coach reply: %w", err)
		}
		defer stream.Close()

		if _, err := io.Copy(os.Stdout, stream); err != nil {
			return fmt.Errorf("reading coach reply stream: %w", err)
		}
		return nil
	},
}

var coachStreamBodyCmd = &cobra.Command{
	Use:   "stream-body <sessionId>",
	Short: "Get the full body of a completed coach stream",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		streamId, _ := cmd.Flags().GetString("stream-id")
		cmdArgs := map[string]any{
			"sessionId": args[0],
		}
		if streamId != "" {
			cmdArgs["streamId"] = streamId
		}
		val, err := client.Query(cmd.Context(), "coach:getStreamBody", cmdArgs)
		return printResult(val, err, "getting stream body")
	},
}

func init() {
	coachStreamStartCmd.Flags().String("message", "", "user message to send to the coach")
	coachStreamStartCmd.Flags().String("context", "", "additional context as JSON")

	coachStreamReplyCmd.Flags().String("message", "", "reply message text (required)")

	coachStreamBodyCmd.Flags().String("stream-id", "", "specific stream ID to retrieve")

	coachCmd.AddCommand(coachStreamStartCmd)
	coachCmd.AddCommand(coachStreamCancelCmd)
	coachCmd.AddCommand(coachStreamReplyCmd)
	coachCmd.AddCommand(coachStreamBodyCmd)
	rootCmd.AddCommand(coachCmd)
}
