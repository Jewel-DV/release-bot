# Release Bot

internal tool to help with releasing our changes.
Repos supported:
- robo-services

It will tag a release, create a release notes and post to Slack `#team-dev-alpha` room.

[ReleaseBot](https://api.slack.com/apps/A05B17TFYSD) to modify



## Setup
Requires Node v14 +
`npm install`

- Create a [Github Personal Access Token](https://github.com/settings/tokens) for access (this is personal)
- Ask #dev for the Slack Bot User OAuth Token (this is shared)
- Create a .env file from .env.example.

# How to run
`node src/main.js --debug --repo ../robo-backend`

For more info and help
`node src/main.js --help`

## Testing

More to come