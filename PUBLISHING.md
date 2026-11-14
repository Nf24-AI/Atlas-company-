# Publishing ATLAS to GitHub — safe setup

## 1. Create the PUBLIC repository

In your GitHub account `Nf24-AI`, create a new **public** repository named **`atlas-company-os`** at <https://github.com/new>. If uploading this prepared folder using Git CLI, create it **without** an auto-generated README/license/gitignore, because those files are included here.

## 2. Upload all files

From the extracted project folder (not from inside the ZIP):

```bash
git init
git branch -M main
git add .
git commit -m "Initial ATLAS Company OS browser game MVP"
git remote add origin https://github.com/Nf24-AI/atlas-company-os.git
git push -u origin main
```

GitHub must authenticate you when pushing. Alternatively, give these project files to Claude Code in a working directory with GitHub authorization, and ask it to perform the same commands. **Never share a GitHub personal access token in chat.**

If Git reports a remote README already exists, clone that repository first and copy the project files into the clone, then commit and push from there instead of force-pushing.

## 3. Enable *STATIC DEMO ONLY* GitHub Pages

After the first push:

1. GitHub repository → **Settings → Pages**.
2. Under Build and deployment select **GitHub Actions**.
3. Open **Actions** and rerun the **Publish static game demo** workflow if needed.
4. When deployment succeeds, visit `https://nf24-ai.github.io/atlas-company-os/`.

This deploys only `ATLAS-PLAYABLE-DEMO.html` renamed to `index.html`. It contains no API secrets and provides deterministic simulated AI. It does **not** deploy `server.js` or give internet access to live AI.

## 4. Give Claude access to the repository

Public access allows Claude to **read** the repo, not automatically **write** to it. Claude Code must be connected to an authenticated GitHub account or a GitHub integration with write permissions to create branches and Pull Requests. Share `https://github.com/Nf24-AI/atlas-company-os` and direct Claude to read `CLAUDE.md` and implement `COS-101` as a reviewable PR.

## 5. Safety requirements before ANY live public API

Implement user authentication, authorization, request throttling, model-spend caps, secrets management, persistent database with access rules, logging privacy and security testing. Do not make the current localhost backend public merely to support GitHub Pages.