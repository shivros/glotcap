package cmd

import (
	"github.com/spf13/cobra"
)

var invitesCmd = &cobra.Command{
	Use:   "invites",
	Short: "Manage invite codes",
	Long:  `Validate and consume invite codes for GlotCap access.`,
}

var invitesValidateCmd = &cobra.Command{
	Use:   "validate <code>",
	Short: "Validate an invite code",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "invites:validateInvite", map[string]any{
			"code": args[0],
		})
		return printResult(val, err, "validating invite")
	},
}

var invitesConsumeCmd = &cobra.Command{
	Use:   "consume <code>",
	Short: "Consume (redeem) an invite code",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Mutation(cmd.Context(), "invites:consumeInvite", map[string]any{
			"code": args[0],
		})
		return printResult(val, err, "consuming invite")
	},
}

func init() {
	invitesCmd.AddCommand(invitesValidateCmd)
	invitesCmd.AddCommand(invitesConsumeCmd)
	rootCmd.AddCommand(invitesCmd)
}
