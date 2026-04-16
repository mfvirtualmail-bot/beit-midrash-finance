# netfree-inspector.bundle — one-time transfer

This branch exists **solely to transport** `netfree-inspector.bundle` (a git bundle
containing the extracted NetFree Inspector extension with full history) from the
Claude Code sandbox to your local machine. The Claude session could not push
directly to `mfvirtualmail-bot/netfree-inspector` because its proxy allowlist
only covered `beit-midrash-finance`.

## How to use

```bash
# 1. Clone your new (empty) repo locally
git clone https://github.com/mfvirtualmail-bot/netfree-inspector.git
cd netfree-inspector

# 2. Download the bundle from this branch (via GitHub raw URL)
curl -L -o /tmp/netfree-inspector.bundle \
  https://raw.githubusercontent.com/mfvirtualmail-bot/beit-midrash-finance/tmp/netfree-inspector-bundle-DELETE-ME/netfree-inspector.bundle

# 3. Fetch the bundle's 'main' branch into your empty clone
git fetch /tmp/netfree-inspector.bundle main:main

# 4. Push to your new repo
git checkout main
git push -u origin main
```

## After you've pushed

Delete this branch on GitHub — it has no other purpose:

```
https://github.com/mfvirtualmail-bot/beit-midrash-finance/branches/yours
```

(the UI shows a trash-can icon next to the branch).
