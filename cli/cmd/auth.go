package cmd

import (
	"fmt"
	"os"

	"github.com/shivros/glotcap/cli/internal/config"
	"github.com/spf13/cobra"
)

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Manage authentication configuration",
	Long:  `Manage the GlotCap CLI authentication: login, logout, and check status.`,
}

var authLoginCmd = &cobra.Command{
	Use:   "login",
	Short: "Save Convex URL and auth token",
	Long:  `Save the Convex deployment URL and auth token to the config file.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		convexURL, _ := cmd.Flags().GetString("convex-url")
		token, _ := cmd.Flags().GetString("token")

		if convexURL == "" {
			return fmt.Errorf("--convex-url is required")
		}

		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("loading config: %w", err)
		}
		cfg.ConvexURL = convexURL
		if token != "" {
			cfg.AuthToken = token
		}
		if err := cfg.Save(); err != nil {
			return fmt.Errorf("saving config: %w", err)
		}

		fmt.Fprintln(os.Stderr, "Configuration saved to", config.ConfigPath())
		return nil
	},
}

var authLogoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Clear stored auth configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := config.Delete(); err != nil {
			return err
		}
		fmt.Fprintln(os.Stderr, "Configuration removed.")
		return nil
	},
}

var authStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show current authentication status",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Resolve()
		if err != nil {
			return err
		}

		if isJSON() {
			out := map[string]any{
				"configured": cfg.ConvexURL != "",
				"has_token":  cfg.AuthToken != "",
			}
			return printJSON(out)
		}

		if cfg.ConvexURL == "" {
			fmt.Println("Not configured. Run 'glotcap auth login --convex-url <url>'.")
			return nil
		}
		fmt.Printf("Convex URL: %s\n", cfg.ConvexURL)
		if cfg.AuthToken != "" {
			fmt.Println("Auth token: configured")
		} else {
			fmt.Println("Auth token: not set")
		}
		return nil
	},
}

func init() {
	authLoginCmd.Flags().String("convex-url", "", "Convex deployment URL (e.g. https://xxx.convex.cloud)")
	authLoginCmd.Flags().String("token", "", "Auth token (JWT from Convex auth)")

	authCmd.AddCommand(authLoginCmd)
	authCmd.AddCommand(authLogoutCmd)
	authCmd.AddCommand(authStatusCmd)
	rootCmd.AddCommand(authCmd)
}
