package cli

import (
	"strings"

	"golang.org/x/xerrors"

	"github.com/coder/coder/cli/clibase"
	"github.com/coder/coder/cli/cliui"
	"github.com/coder/coder/codersdk"
)

func (r *RootCmd) publickey() *clibase.Cmd {
	var reset bool

	cmd := &clibase.Cmd{
		Use:     "publickey",
		Aliases: []string{"pubkey"},
		Short:   "Output your Coder public key used for Git operations",
		Handler: func(inv *clibase.Invokation) error {
			client, err := useClient(cmd)
			if err != nil {
				return xerrors.Errorf("create codersdk client: %w", err)
			}

			if reset {
				// Confirm prompt if using --reset. We don't want to accidentally
				// reset our public key.
				_, err := cliui.Prompt(inv, cliui.PromptOptions{
					Text: "Confirm regenerate a new sshkey for your workspaces? This will require updating the key " +
						"on any services it is registered with. This action cannot be reverted.",
					IsConfirm: true,
				})
				if err != nil {
					return err
				}

				// Reset the public key, let the retrieve re-read it.
				_, err = client.RegenerateGitSSHKey(inv.Context(), codersdk.Me)
				if err != nil {
					return err
				}
			}

			key, err := client.GitSSHKey(inv.Context(), codersdk.Me)
			if err != nil {
				return xerrors.Errorf("create codersdk client: %w", err)
			}

			cmd.Println(cliui.Styles.Wrap.Render(
				"This is your public key for using " + cliui.Styles.Field.Render("git") + " in " +
					"Coder. All clones with SSH will be authenticated automatically 🪄.",
			))
			cmd.Println()
			cmd.Println(cliui.Styles.Code.Render(strings.TrimSpace(key.PublicKey)))
			cmd.Println()
			cmd.Println("Add to GitHub and GitLab:")
			cmd.Println(cliui.Styles.Prompt.String() + "https://github.com/settings/ssh/new")
			cmd.Println(cliui.Styles.Prompt.String() + "https://gitlab.com/-/profile/keys")

			return nil
		},
	}
	cmd.Flags().BoolVar(&reset, "reset", false, "Regenerate your public key. This will require updating the key on any services it's registered with.")
	cliui.AllowSkipPrompt(inv)

	return cmd
}
