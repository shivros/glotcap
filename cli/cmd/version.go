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
	Run: func(cmd *cobra.Command, args []string) {
		if isJSON() {
			printJSON(map[string]string{
				"version": Version,
				"cli":     "glotcap",
			})
		} else {
			fmt.Println("glotcap CLI v" + Version)
		}
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
