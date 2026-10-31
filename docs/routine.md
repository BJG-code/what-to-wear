# Routine for each feature

The same six steps every time, one feature per session. The build order is in [gaps.md](gaps.md).

1. **Start a new session** in the Claude app for this repository.
2. **Say "do the next session".** Claude reads `CLAUDE.md`, finds the next unticked session in `docs/gaps.md`, builds it, and explains in plain English what changed.
3. **Ask Claude to "open the PR"**, and to "watch the PR" if you'd like it to deal with any failed checks or comments.
4. **Check the pull request:**
   - the **Checks** tab shows a green tick (the automated checks passed);
   - the **Files changed** tab shows what changed: red lines are the old versions, green lines the new ones.
5. **Merge it:** tap **Merge pull request**, then **Confirm merge**. **Delete branch** is safe to tap afterwards. The change goes live on the site within a few minutes.
6. **Check it on your phone** at https://bjg-code.github.io/what-to-wear/.

Then close that session and start a fresh one for the next feature.

## Words you'll see

- **Commit**: a saved step in the project's history, which you can go back to.
- **Branch**: a separate copy where a session works, so the live app isn't touched until you merge.
- **Pull request (PR)**: a request to add a branch's changes to the main version. It shows what changed and runs the checks.
- **Check**: the automated tests, run on an iPhone-sized and a laptop-sized screen. Green tick means they passed.
- **Merge**: adds the changes to the main version, which is what goes live.
