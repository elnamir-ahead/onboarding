# Teams App Package (ARCHIE Test)

This folder version-controls the Microsoft Teams app manifest for the onboarding bot.

## Files

- `manifest.json` - Teams app definition (bot scopes, app metadata)
- `color.png` - 192x192 icon (required for upload)
- `outline.png` - 32x32 transparent outline icon (required for upload)

## Required updates before upload

1. Set `bots[0].botId` to the Azure Bot App ID used by ECS (`MICROSOFT_APP_ID` secret).
2. Ensure `name`, `description`, and `developer` metadata are correct for your tenant.
3. Add required icons:
   - `color.png` (192x192)
   - `outline.png` (32x32)
4. Increment `version` in `manifest.json` for every publish.

## Package and upload

From this directory:

```bash
bash package.sh
```

This creates `ARCHIE-Test-teams-app.zip`.

Upload in Teams Admin Center:

- Teams apps -> Manage apps -> Upload new app
- Then allow app via permission/setup policies for target users.

## Troubleshooting

- "You cannot send messages to this bot":
  - check `bots[0].scopes` includes `"personal"`
  - check `isNotificationOnly` is `false`
  - verify app is allowed in Teams Admin policies
  - verify Azure Bot Teams channel is enabled and endpoint is valid
