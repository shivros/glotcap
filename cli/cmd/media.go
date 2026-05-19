package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var mediaCmd = &cobra.Command{
	Use:   "media",
	Short: "Media upload and processing",
	Long:  `Get upload URLs, create processing jobs, and check job status.`,
}

var mediaUploadUrlCmd = &cobra.Command{
	Use:   "upload-url",
	Short: "Get a presigned upload URL",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "mediaTools:generateUploadUrl", map[string]any{})
		return printResult(val, err, "getting upload URL")
	},
}

var mediaCreateJobCmd = &cobra.Command{
	Use:   "create-job",
	Short: "Create a media processing job",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		tool, _ := cmd.Flags().GetString("tool")
		inputStorageId, _ := cmd.Flags().GetString("input-storage-id")
		inputFileName, _ := cmd.Flags().GetString("input-file-name")
		if tool == "" {
			return fmt.Errorf("--tool is required (transcript, srt, or bilingual)")
		}
		if inputStorageId == "" {
			return fmt.Errorf("--input-storage-id is required")
		}
		if inputFileName == "" {
			return fmt.Errorf("--input-file-name is required")
		}
		cmdArgs := map[string]any{
			"tool":            tool,
			"inputStorageId":  inputStorageId,
			"inputFileName":   inputFileName,
		}
		inputMimeType, _ := cmd.Flags().GetString("input-mime-type")
		if inputMimeType != "" {
			cmdArgs["inputMimeType"] = inputMimeType
		}
		sourceLanguage, _ := cmd.Flags().GetString("source-language")
		if sourceLanguage != "" {
			cmdArgs["sourceLanguage"] = sourceLanguage
		}
		targetLanguage, _ := cmd.Flags().GetString("target-language")
		if targetLanguage != "" {
			cmdArgs["targetLanguage"] = targetLanguage
		}
		delimiter, _ := cmd.Flags().GetString("delimiter")
		if delimiter != "" {
			cmdArgs["delimiter"] = delimiter
		}
		bilingualOutput, _ := cmd.Flags().GetString("bilingual-output")
		if bilingualOutput != "" {
			cmdArgs["bilingualOutput"] = bilingualOutput
		}
		val, err := client.Mutation(cmd.Context(), "mediaTools:createJob", cmdArgs)
		return printResult(val, err, "creating media job")
	},
}

var mediaGetJobCmd = &cobra.Command{
	Use:   "get-job <jobId>",
	Short: "Get status of a media processing job",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "mediaTools:getJob", map[string]any{
			"jobId": args[0],
		})
		return printResult(val, err, "getting media job")
	},
}

var mediaListJobsCmd = &cobra.Command{
	Use:   "list-jobs",
	Short: "List media processing jobs",
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
		val, err := client.Query(cmd.Context(), "mediaTools:listRecentJobs", cmdArgs)
		return printResult(val, err, "listing media jobs")
	},
}

func init() {
	mediaCreateJobCmd.Flags().String("tool", "", "processing tool: transcript, srt, or bilingual (required)")
	mediaCreateJobCmd.Flags().String("input-storage-id", "", "Convex storage ID of uploaded file (required)")
	mediaCreateJobCmd.Flags().String("input-file-name", "", "original file name (required)")
	mediaCreateJobCmd.Flags().String("input-mime-type", "", "MIME type of the input file")
	mediaCreateJobCmd.Flags().String("source-language", "", "source language code")
	mediaCreateJobCmd.Flags().String("target-language", "", "target language code")
	mediaCreateJobCmd.Flags().String("delimiter", "", "delimiter for bilingual output")
	mediaCreateJobCmd.Flags().String("bilingual-output", "", "bilingual output format: transcript, srt, or both")
	mediaListJobsCmd.Flags().Int("limit", 0, "max number of jobs to return")

	mediaCmd.AddCommand(mediaUploadUrlCmd)
	mediaCmd.AddCommand(mediaCreateJobCmd)
	mediaCmd.AddCommand(mediaGetJobCmd)
	mediaCmd.AddCommand(mediaListJobsCmd)
	rootCmd.AddCommand(mediaCmd)
}
