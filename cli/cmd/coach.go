package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"
)

var coachCmd = &cobra.Command{
	Use:   "coach",
	Short: "Interact with the AI speaking coach",
	Long:  `Start coach reply streams, cancel streams, and retrieve stream bodies.`,
}

var coachStreamStartCmd = &cobra.Command{
	Use:   "stream-start <sessionId>",
	Short: "Start a coach reply stream",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		turnId, _ := cmd.Flags().GetString("turn-id")
		if turnId == "" {
			return fmt.Errorf("--turn-id is required")
		}

		// Step 1: Call speaking:startCoachReplyStream mutation to get streamId + eventId
		mutResult, err := client.Mutation(cmd.Context(), "speaking:startCoachReplyStream", map[string]any{
			"sessionId": args[0],
			"turnId":    turnId,
		})
		if err != nil {
			return fmt.Errorf("starting coach reply stream: %w", err)
		}

		var startResp struct {
			StreamId string `json:"streamId"`
			EventId  string `json:"eventId"`
		}
		if err := json.Unmarshal(mutResult, &startResp); err != nil {
			return fmt.Errorf("parsing startCoachReplyStream response: %w", err)
		}

		fmt.Fprintf(os.Stderr, "streamId: %s\neventId: %s\n", startResp.StreamId, startResp.EventId)

		// Step 2: POST to /coach-stream HTTP route with streamId
		stream, err := client.HTTPStream(cmd.Context(), "/coach-stream", map[string]any{
			"streamId": startResp.StreamId,
		})
		if err != nil {
			return fmt.Errorf("connecting to coach stream: %w", err)
		}
		defer stream.Close()

		if _, err := io.Copy(os.Stdout, stream); err != nil {
			return fmt.Errorf("reading coach stream: %w", err)
		}
		return nil
	},
}

var coachStreamCancelCmd = &cobra.Command{
	Use:   "stream-cancel <eventId>",
	Short: "Cancel an active coach reply stream",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "speaking:cancelCoachReplyStream", map[string]any{
			"eventId": args[0],
		})
		return printResult(val, err, "canceling coach stream")
	},
}

var coachStreamBodyCmd = &cobra.Command{
	Use:   "stream-body <streamId>",
	Short: "Get the full body of a completed coach stream",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "streaming:getStreamBody", map[string]any{
			"streamId": args[0],
		})
		return printResult(val, err, "getting stream body")
	},
}

func init() {
	coachStreamStartCmd.Flags().String("turn-id", "", "turn ID for the coach reply (required)")

	coachCmd.AddCommand(coachStreamStartCmd)
	coachCmd.AddCommand(coachStreamCancelCmd)
	coachCmd.AddCommand(coachStreamBodyCmd)
	rootCmd.AddCommand(coachCmd)
}
