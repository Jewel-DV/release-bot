import { WebClient } from "@slack/web-api";
import config from "../config.js";
import { writeFileSync } from "fs";
import os from "os";
import path from 'path';

export const slackClient = new WebClient(
  config.SLACK_BOT_USER_OAUTH_ACCESS_TOKEN
);

/**
 * Helper function to generate a list of Slack elements of Pull Request information
 * @param ctx Context from Listr
 * @returns {[{}]} e.g: #255 | chrome extension by @Multi-Thinker on '10/20/2020, 10:23:54 AM'
 */
function generatePullRequestsElements(ctx) {
  let textElements = [];
  for (const id in ctx.pr) {
    const pr = ctx.pr[id];
    textElements.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${pr.html_url}| #${pr.number}> | ${pr.title} by @${
            pr.user.login
          } on ${new Date(pr.merged_at).toLocaleString()}`,
        },
      ],
    });
  }
  return textElements;
}

/**
 * Helper function for main.js to generate Slack Message that contains
 * Pull Request information for this release.
 * side-effect: Stores ctx.slackMessage to be sent to Slack channel.
 * @returns {{task: task, title: string}}
 */
export function generateReleaseSlackBlockTask() {
  return {
    title: "Generate Slack Message",
    task: (ctx, task) => {
      ctx.slackMessage = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${ctx.title}: Merged ${ctx.branches.from} to ${ctx.branches.to}`,
          },
        },
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<${ctx.releaseURL}| Release: ${ctx.tag_name}> at ${ctx.endPoint}`,
          },
        },
        { type: "divider" },
        ...generatePullRequestsElements(ctx)
      ];
      // debugging purpose

      try {
        const filePath = os.tmpdir() + path.sep + 'slackMessage.json';
        writeFileSync(filePath, JSON.stringify(ctx.slackMessage, null, 4));
      } catch (error) {
        console.log(error.toString());
      }
    },
  };
}
