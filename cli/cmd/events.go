package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var eventsCmd = &cobra.Command{
	Use:   "events",
	Short: "Manage session events",
	Long:  `Append events, upsert transcripts, and save translations for speaking sessions.`,
}

var eventsAppendCmd = &cobra.Command{
	Use:   "append <sessionId>",
	Short: "Append an event to a speaking session",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		eventType, _ := cmd.Flags().GetString("type")
		if eventType == "" {
			return fmt.Errorf("--type is required (transcript, correction, or system)")
		}
		cmdArgs := map[string]any{
			"sessionId": args[0],
			"type":      eventType,
		}
		// Optional fields
		text, _ := cmd.Flags().GetString("text")
		if text != "" {
			cmdArgs["text"] = text
		}
		speaker, _ := cmd.Flags().GetString("speaker")
		if speaker != "" {
			cmdArgs["speaker"] = speaker
		}
		provider, _ := cmd.Flags().GetString("provider")
		if provider != "" {
			cmdArgs["provider"] = provider
		}
		turnId, _ := cmd.Flags().GetString("turn-id")
		if turnId != "" {
			cmdArgs["turnId"] = turnId
		}
		streamId, _ := cmd.Flags().GetString("stream-id")
		if streamId != "" {
			cmdArgs["streamId"] = streamId
		}
		streamStatus, _ := cmd.Flags().GetString("stream-status")
		if streamStatus != "" {
			cmdArgs["streamStatus"] = streamStatus
		}
		title, _ := cmd.Flags().GetString("title")
		if title != "" {
			cmdArgs["title"] = title
		}
		detail, _ := cmd.Flags().GetString("detail")
		if detail != "" {
			cmdArgs["detail"] = detail
		}
		severity, _ := cmd.Flags().GetString("severity")
		if severity != "" {
			cmdArgs["severity"] = severity
		}
		payloadJSON, _ := cmd.Flags().GetString("payload")
		if payloadJSON != "" {
			var payloadData any
			if err := parseJSONArg(payloadJSON, &payloadData); err != nil {
				return fmt.Errorf("--payload must be valid JSON: %w", err)
			}
			cmdArgs["payload"] = payloadData
		}
		val, err := client.Mutation(cmd.Context(), "speaking:appendEvent", cmdArgs)
		return printResult(val, err, "appending event")
	},
}

var eventsUpsertTranscriptCmd = &cobra.Command{
	Use:   "upsert-transcript <sessionId>",
	Short: "Upsert a user transcript for a session",
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
		eventId, _ := cmd.Flags().GetString("event-id")
		if eventId != "" {
			cmdArgs["eventId"] = eventId
		}
		provider, _ := cmd.Flags().GetString("provider")
		if provider != "" {
			cmdArgs["provider"] = provider
		}
		turnId, _ := cmd.Flags().GetString("turn-id")
		if turnId != "" {
			cmdArgs["turnId"] = turnId
		}
		speaker, _ := cmd.Flags().GetString("speaker")
		if speaker != "" {
			cmdArgs["speaker"] = speaker
		}
		val, err := client.Mutation(cmd.Context(), "speaking:upsertUserTranscript", cmdArgs)
		return printResult(val, err, "upserting transcript")
	},
}

var eventsSaveTranslationCmd = &cobra.Command{
	Use:   "save-translation <eventId>",
	Short: "Save a translation for a session event",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		translatedText, _ := cmd.Flags().GetString("translated-text")
		if translatedText == "" {
			return fmt.Errorf("--translated-text is required")
		}
		val, err := client.Mutation(cmd.Context(), "speaking:saveEventTranslation", map[string]any{
			"eventId":       args[0],
			"translatedText": translatedText,
		})
		return printResult(val, err, "saving translation")
	},
}

func init() {
	eventsAppendCmd.Flags().String("type", "", "event type: transcript, correction, or system (required)")
	eventsAppendCmd.Flags().String("text", "", "event text")
	eventsAppendCmd.Flags().String("speaker", "", "speaker: user, teacher, coach, or system")
	eventsAppendCmd.Flags().String("provider", "", "provider name")
	eventsAppendCmd.Flags().String("turn-id", "", "turn ID")
	eventsAppendCmd.Flags().String("stream-id", "", "stream ID")
	eventsAppendCmd.Flags().String("stream-status", "", "stream status: streaming, done, error, or canceled")
	eventsAppendCmd.Flags().String("title", "", "event title")
	eventsAppendCmd.Flags().String("detail", "", "event detail")
	eventsAppendCmd.Flags().String("severity", "", "severity: low, medium, high, or positive")
	eventsAppendCmd.Flags().String("payload", "", "arbitrary JSON payload")

	eventsUpsertTranscriptCmd.Flags().String("text", "", "transcript text (required)")
	eventsUpsertTranscriptCmd.Flags().String("event-id", "", "existing event ID to upsert")
	eventsUpsertTranscriptCmd.Flags().String("provider", "", "STT provider")
	eventsUpsertTranscriptCmd.Flags().String("turn-id", "", "turn ID")
	eventsUpsertTranscriptCmd.Flags().String("speaker", "", "speaker: user or teacher")

	eventsSaveTranslationCmd.Flags().String("translated-text", "", "translated text (required)")

	eventsCmd.AddCommand(eventsAppendCmd)
	eventsCmd.AddCommand(eventsUpsertTranscriptCmd)
	eventsCmd.AddCommand(eventsSaveTranslationCmd)
	rootCmd.AddCommand(eventsCmd)
}
