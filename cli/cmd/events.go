package cmd

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

var eventsCmd = &cobra.Command{
	Use:   "events",
	Short: "Manage session events",
	Long:  `Append events, upsert transcripts, and save translations for speaking sessions.`,
}

var eventsAppendCmd = &cobra.Command{
	Use:   "append <sessionId>",
	Short: "Append events to a speaking session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		eventsJSON, _ := cmd.Flags().GetString("events")
		if eventsJSON == "" {
			return fmt.Errorf("--events is required (JSON array of events)")
		}
		var eventsData []map[string]any
		if err := parseJSONArg(eventsJSON, &eventsData); err != nil {
			return fmt.Errorf("--events must be a valid JSON array: %w", err)
		}
		val, err := client.Mutation(cmd.Context(), "speaking:appendEvent", map[string]any{
			"sessionId": args[0],
			"events":    eventsData,
			"requestId": uuid.New().String(),
		})
		return printResult(val, err, "appending events")
	},
}

var eventsUpsertTranscriptCmd = &cobra.Command{
	Use:   "upsert-transcript <sessionId>",
	Short: "Upsert a transcript segment for a session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		transcriptJSON, _ := cmd.Flags().GetString("transcript")
		if transcriptJSON == "" {
			return fmt.Errorf("--transcript is required (JSON object)")
		}
		var transcriptData map[string]any
		if err := parseJSONArg(transcriptJSON, &transcriptData); err != nil {
			return fmt.Errorf("--transcript must be a valid JSON object: %w", err)
		}
		val, err := client.Mutation(cmd.Context(), "speaking:upsertUserTranscript", map[string]any{
			"sessionId":  args[0],
			"transcript": transcriptData,
			"requestId":  uuid.New().String(),
		})
		return printResult(val, err, "upserting transcript")
	},
}

var eventsSaveTranslationCmd = &cobra.Command{
	Use:   "save-translation <sessionId>",
	Short: "Save a translation for a session event",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		translationJSON, _ := cmd.Flags().GetString("translation")
		if translationJSON == "" {
			return fmt.Errorf("--translation is required (JSON object)")
		}
		var translationData map[string]any
		if err := parseJSONArg(translationJSON, &translationData); err != nil {
			return fmt.Errorf("--translation must be a valid JSON object: %w", err)
		}
		val, err := client.Mutation(cmd.Context(), "speaking:saveEventTranslation", map[string]any{
			"sessionId":   args[0],
			"translation": translationData,
			"requestId":   uuid.New().String(),
		})
		return printResult(val, err, "saving translation")
	},
}

func init() {
	eventsAppendCmd.Flags().String("events", "", "JSON array of events to append (required)")
	eventsUpsertTranscriptCmd.Flags().String("transcript", "", "transcript data as JSON (required)")
	eventsSaveTranslationCmd.Flags().String("translation", "", "translation data as JSON (required)")

	eventsCmd.AddCommand(eventsAppendCmd)
	eventsCmd.AddCommand(eventsUpsertTranscriptCmd)
	eventsCmd.AddCommand(eventsSaveTranslationCmd)
	rootCmd.AddCommand(eventsCmd)
}
