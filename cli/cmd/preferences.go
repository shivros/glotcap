package cmd

import (
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
	Short: "Set language preferences",
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := getClient()
		if err != nil {
			return err
		}
		language, _ := cmd.Flags().GetString("language")
		level, _ := cmd.Flags().GetString("level")
		native, _ := cmd.Flags().GetString("native-language")
		cmdArgs := map[string]any{}
		if language != "" {
			cmdArgs["language"] = language
		}
		if level != "" {
			cmdArgs["level"] = level
		}
		if native != "" {
			cmdArgs["nativeLanguage"] = native
		}
		val, err := client.Mutation(cmd.Context(), "preferences:setLanguage", cmdArgs)
		return printResult(val, err, "setting language preferences")
	},
}

func init() {
	preferencesSetLanguageCmd.Flags().String("language", "", "target language code (e.g. 'es')")
	preferencesSetLanguageCmd.Flags().String("level", "", "proficiency level")
	preferencesSetLanguageCmd.Flags().String("native-language", "", "native language code")

	preferencesCmd.AddCommand(preferencesGetLanguageCmd)
	preferencesCmd.AddCommand(preferencesSetLanguageCmd)
	rootCmd.AddCommand(preferencesCmd)
}
