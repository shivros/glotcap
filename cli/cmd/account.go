package cmd

import (

	"github.com/spf13/cobra"
)

var accountCmd = &cobra.Command{
	Use:   "account",
	Short: "Manage account email changes",
	Long:  `Request, verify, cancel, and check status of email address changes.`,
}

var accountEmailChangeStatusCmd = &cobra.Command{
	Use:   "email-change-status",
	Short: "Get current email change status",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "account:getEmailChangeStatus", map[string]any{})
		return printResult(val, err, "getting email change status")
	},
}

var accountEmailChangeRequestCmd = &cobra.Command{
	Use:   "email-change-request <new-email>",
	Short: "Request an email address change",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "account:requestEmailChange", map[string]any{
			"newEmail": args[0],
		})
		return printResult(val, err, "requesting email change")
	},
}

var accountEmailChangeVerifyCmd = &cobra.Command{
	Use:   "email-change-verify <code>",
	Short: "Verify an email change with the confirmation code",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "account:verifyEmailChange", map[string]any{
			"code": args[0],
		})
		return printResult(val, err, "verifying email change")
	},
}

var accountEmailChangeCancelCmd = &cobra.Command{
	Use:   "email-change-cancel",
	Short: "Cancel a pending email change",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "account:cancelEmailChange", map[string]any{})
		return printResult(val, err, "canceling email change")
	},
}

var accountEmailChangeResendCmd = &cobra.Command{
	Use:   "email-change-resend",
	Short: "Resend the email change verification",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "account:resendEmailChange", map[string]any{})
		return printResult(val, err, "resending email change")
	},
}

func init() {
	accountCmd.AddCommand(accountEmailChangeStatusCmd)
	accountCmd.AddCommand(accountEmailChangeRequestCmd)
	accountCmd.AddCommand(accountEmailChangeVerifyCmd)
	accountCmd.AddCommand(accountEmailChangeCancelCmd)
	accountCmd.AddCommand(accountEmailChangeResendCmd)
	rootCmd.AddCommand(accountCmd)
}
