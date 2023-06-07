import dotenv from "dotenv"
dotenv.config()

const config = {
    GITHUB_OWNER: process.env.GITHUB_OWNER || 'Jewel-DV',
    GITHUB_PERSONAL_TOKEN: process.env.GITHUB_PERSONAL_TOKEN,
    SLACK_BOT_USER_OAUTH_ACCESS_TOKEN: process.env.SLACK_BOT_USER_OAUTH_ACCESS_TOKEN,
    SLACK_CHANNEL: process.env.SLACK_CHANNEL || "dev"
}

export default config
