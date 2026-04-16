# netfree-inspector.bundle — one-time transfer

This branch exists **solely to transport** `netfree-inspector.bundle` (a git bundle
containing the extracted NetFree Inspector extension with full history) from the
Claude Code sandbox to your local machine. The Claude session could not push
directly to `mfvirtualmail-bot/netfree-inspector` because its proxy allowlist
only covered `beit-midrash-finance`.

## How to use

> **If you are behind NetFree**, skip to the "NetFree workaround" section below —
> NetFree blocks binary downloads from `raw.githubusercontent.com`.

```bash
# 1. Clone your new (empty) repo locally
git clone https://github.com/mfvirtualmail-bot/netfree-inspector.git
cd netfree-inspector

# 2. Download the bundle from this branch (via GitHub raw URL)
curl -L -o /tmp/netfree-inspector.bundle \
  https://raw.githubusercontent.com/mfvirtualmail-bot/beit-midrash-finance/refs/heads/tmp/netfree-inspector-bundle-DELETE-ME/netfree-inspector.bundle

# 3. Fetch the bundle's 'main' branch into your empty clone
git fetch /tmp/netfree-inspector.bundle main:main

# 4. Push to your new repo
git checkout main
git push -u origin main
```

## NetFree workaround (Windows PowerShell)

NetFree blocks `.bundle` binary downloads. A base64 text copy of the bundle is
committed alongside it as `netfree-inspector.bundle.base64.txt`. Download the
text, decode locally, then use it like a normal bundle.

```powershell
cd C:\Users\Admin\netfree-inspector

# 1. Download the base64 text (NetFree does NOT block .txt)
curl.exe -L -o "$env:TEMP\ni.bundle.b64" https://raw.githubusercontent.com/mfvirtualmail-bot/beit-midrash-finance/refs/heads/tmp/netfree-inspector-bundle-DELETE-ME/netfree-inspector.bundle.base64.txt

# 2. Decode to the real bundle file
[IO.File]::WriteAllBytes("$env:TEMP\ni.bundle", [Convert]::FromBase64String((Get-Content "$env:TEMP\ni.bundle.b64" -Raw)))

# 3. Verify (should say "The bundle records a complete history." and show "refs/heads/main")
git bundle verify "$env:TEMP\ni.bundle"

# 4. Load into clone and push
git fetch "$env:TEMP\ni.bundle" main:main
git checkout main
git push -u origin main
```

## After you've pushed

Delete this branch on GitHub — it has no other purpose:

```
https://github.com/mfvirtualmail-bot/beit-midrash-finance/branches/yours
```

(the UI shows a trash-can icon next to the branch).
