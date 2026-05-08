package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var preferencesCmd = &cobra.Command{
	Use:   "preferences",
	Short: "Manage language preferences",
	Long:  `Get and set the user's language learning preferences.`,
}

var preferencesGetLanguageCmd = &cobra.Command{
	Use:   "get-language",
	Short: "Get current language preferences",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		val, err := client.Query(cmd.Context(), "userPreferences:getMyLanguagePreference", map[string]any{})
		return printResult(val, err, "getting language preferences")
	},
}

var preferencesSetLanguageCmd = &cobra.Command{
	Use:   "set-language",
	Short: "Set language preference",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		languageId, _ := cmd.Flags().GetString("language-id")
		if languageId == "" {
			return fmt.Errorf("--language-id is required")
		}
		val, err := client.Mutation(cmd.Context(), "userPreferences:setMyLanguagePreference", map[string]any{
			"languageId": languageId,
		})
		return printResult(val, err, "setting language preferences")
	},
}

func init() {
	preferencesSetLanguageCmd.Flags().String("language-id", "", "language ID to set as preference (required)")

	preferencesCmd.AddCommand(preferencesGetLanguageCmd)
	preferencesCmd.AddCommand(preferencesSetLanguageCmd)
	rootCmd.AddCommand(preferencesCmd)
}
