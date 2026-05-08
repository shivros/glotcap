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
		contentType, _ := cmd.Flags().GetString("content-type")
		if contentType == "" {
			return fmt.Errorf("--content-type is required")
		}
		val, err := client.Mutation(cmd.Context(), "media:getUploadUrl", map[string]any{
			"contentType": contentType,
		})
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
		storageId, _ := cmd.Flags().GetString("storage-id")
		jobType, _ := cmd.Flags().GetString("type")
		if storageId == "" {
			return fmt.Errorf("--storage-id is required")
		}
		if jobType == "" {
			return fmt.Errorf("--type is required")
		}
		cmdArgs := map[string]any{
			"storageId": storageId,
			"type":      jobType,
		}
		val, err := client.Mutation(cmd.Context(), "media:createJob", cmdArgs)
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
		val, err := client.Query(cmd.Context(), "media:getJob", map[string]any{
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
		status, _ := cmd.Flags().GetString("status")
		limit, _ := cmd.Flags().GetInt("limit")
		cmdArgs := map[string]any{}
		if status != "" {
			cmdArgs["status"] = status
		}
		if limit > 0 {
			cmdArgs["limit"] = limit
		}
		val, err := client.Query(cmd.Context(), "media:listJobs", cmdArgs)
		return printResult(val, err, "listing media jobs")
	},
}

func init() {
	mediaUploadUrlCmd.Flags().String("content-type", "", "MIME type of the file to upload (required)")
	mediaCreateJobCmd.Flags().String("storage-id", "", "Convex storage ID of uploaded file (required)")
	mediaCreateJobCmd.Flags().String("type", "", "type of processing job (required)")
	mediaListJobsCmd.Flags().String("status", "", "filter by job status")
	mediaListJobsCmd.Flags().Int("limit", 0, "max number of jobs to return")

	mediaCmd.AddCommand(mediaUploadUrlCmd)
	mediaCmd.AddCommand(mediaCreateJobCmd)
	mediaCmd.AddCommand(mediaGetJobCmd)
	mediaCmd.AddCommand(mediaListJobsCmd)
	rootCmd.AddCommand(mediaCmd)
}
