package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// Version is set at build time via -ldflags.
var Version = "0.1.0-dev"

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the CLI version",
	RunE: func(cmd *cobra.Command, args []string) error {
		if isJSON() {
			return printJSON(map[string]string{
				"version": Version,
				"cli":     "glotcap",
			})
		}
		fmt.Println("glotcap CLI v" + Version)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
