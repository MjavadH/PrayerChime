# Release process

Use this checklist whenever you publish a new Obsidian plugin release.

1. Start from an up-to-date release branch and make sure the working tree is clean.
2. Bump the version with npm so `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` stay in sync:

   ```bash
   npm version patch
   ```

   Use `npm version minor` or `npm version major` instead when appropriate.
3. Run the same checks used by the release workflow:

   ```bash
   npm ci --ignore-scripts
   npm test
   npm run build
   ```

4. Push the commit and the tag created by `npm version`:

   ```bash
   git push
   git push --tags
   ```

5. Create or publish the GitHub Release from that exact tag. The release workflow checks out the tag, installs dependencies from `package-lock.json`, builds `main.js`, and uploads `main.js`, `styles.css`, and `manifest.json` to the release.

Do not create a GitHub Release from a tag that points to an older commit. If the tag does not include the matching lock file and manifest changes, `npm ci` will fail because GitHub Actions builds the code at the release tag.
