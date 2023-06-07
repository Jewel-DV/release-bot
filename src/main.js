import dotenv from "dotenv";
dotenv.config();
import config from "./config.js";
import log from "./lib/logger.js";
import {
  octokit,
  extractPullRequestIDs,
  fetchPullRequestByID,
  createRelease,
} from "./lib/github.js";
import { program } from "commander";
import Listr from "listr";
import util from "util";
import child_process from "child_process";
import chalk from "chalk";
import { generateReleaseSlackBlockTask, slackClient } from "./lib/slack.js";
const exec = util.promisify(child_process.exec);

program
  .requiredOption(
    "--repo <path>",
    "Path to the repository you want to make a release for."
  )
  .option("--debug", "Show only the list of PRs that will be deployed");
program.parse(process.argv);

if (program.debug) {
  log.error("DEBUG MODE ON -- everything should be read only");
}
[
  "GITHUB_OWNER",
  "GITHUB_PERSONAL_TOKEN",
  "SLACK_BOT_USER_OAUTH_ACCESS_TOKEN",
].forEach((envVar) => {
  if (!process.env[envVar]) {
    log.error("Please set the env variable " + chalk.bgBlue(envVar));
    process.exit(1);
  } else {
    log.debug(envVar + "=" + process.env[envVar]);
  }
});

const tasks = new Listr(
  [
    {
      title: "Verify Repo Path",
      task: async (ctx, task) => {
        log.info(`Releasing on ${program.repo}`);
        process.chdir(program.repo);
        const { stdout } = await exec("git config --get remote.origin.url");
        log.debug(stdout);

        switch (stdout.trim()) {
          case "https://github.com/Jewel-DV/robo-services.git":
          case "git@github.com:Jewel-DV/robo-services.git":
            ctx.title = "Robo Backend Release";
            task.title = chalk.blue(ctx.title);
            ctx.branches = { from: "develop", to: "main" };
            ctx.github_repo = "robo-services";
            ctx.dev_slack_channel = config.SLACK_CHANNEL;
            ctx.endPoint = "https://example.com/";
            ctx.releaseURL =
              "https://github.com/Jewel-DV/robo-services/releases";
            break;
          default:
            log.error(`No release support for: ${program.repo}`);
            process.exit(1);
        }
      },
    },
    {
      title: "Update Repository to Local",
      task: (ctx, task) => {
        return new Listr([
          {
            title: `Fetching ${ctx.branches.from} and ${ctx.branches.to}`,
            task: () => exec("git fetch --all"),
          },
          {
            title: `Checking out ${ctx.branches.from}`,
            task: () => exec(`git checkout ${ctx.branches.from}`),
          },
          {
            title: `Pulling from ${ctx.branches.from}`,
            task: () => exec(`git pull origin ${ctx.branches.from}`),
          },
          {
            title: `Checking out ${ctx.branches.to}`,
            task: () => exec(`git checkout ${ctx.branches.to}`),
          },
          {
            title: `Pulling from ${ctx.branches.to}`,
            task: () => exec(`git pull origin ${ctx.branches.to}`),
          },
        ]);
      },
    },
    {
      title: "Get Git changes",
      task: async (ctx, task) => {
        const { stdout } = await exec(
          `git log --oneline ${ctx.branches.to}..${ctx.branches.from}`
        );
        ctx.raw_git_log = stdout;
      },
    },
    {
      title: "Extract Pull Request IDs from Git logs",
      task: async (ctx, task) => {
        ctx.pr_ids = extractPullRequestIDs(ctx.raw_git_log);
        ctx.pr = {};
      },
    },
    {
      title: "Fetch Pull Request Metadata",
      task: async (ctx, task) => {
        return new Listr(
          ctx.pr_ids.map((pr_id) => {
            return {
              title: `# ${pr_id}`,
              task: async (ctx, task) => {
                const pr_data = await fetchPullRequestByID(
                  ctx.github_repo,
                  pr_id
                );
                ctx.pr[pr_id] = pr_data;
                task.title = `PR-${pr_data.number} | ${chalk.yellow(
                  pr_data.user.login
                )} | ${chalk.green(pr_data.title)} | ${pr_data.html_url}`;
              },
            };
          }),
          { concurrent: false, collapse: false }
        );
      },
    },
    {
      title: "Merge branches",
      enabled: () => {
        return !program.debug;
      },
      task: (ctx, task) => {
        task.title = `Merging ${ctx.branches.from} into ${ctx.branches.to}`;
        if (program.debug) {
          return task.skip("Disable in debug mode");
        }
        return exec("git merge " + ctx.branches.from);
      },
    },
    {
      title: "Push branch to Github",
      enabled: () => {
        return !program.debug;
      },
      task: (ctx, task) => {
        task.title = "Push " + ctx.branches.to + " to Github";
        if (program.debug) {
          return task.skip("Disable in debug mode");
        }
        return exec("git push origin " + ctx.branches.to);
      },
    },
    {
      title: "Create Git tag",
      enabled: () => {
        return !program.debug;
      },
      task: (ctx, task) => {
        if (program.debug) return task.skip("Disabled in debug mode");
        ctx.tag_name =
          "v" +
          new Date().toISOString().substr(0, 10) +
          "-" +
          new Date().getTime();
        task.title = "Create Git tag " + ctx.tag_name;
        return exec("git tag " + ctx.tag_name);
      },
    },
    {
      title: "Push tag to Github",
      enabled: () => {
        return !program.debug;
      },
      task: (ctx, task) => {
        task.title = "Push tag " + ctx.tag_name + " to Github";
        if (program.debug) return task.skip("Disable in debug mode");
        return exec("git push origin " + ctx.tag_name);
      },
    },
    {
      title: "Creating Github Release Notes",
      task: (ctx, task) => {
        task.title = `Create Github Release \n   https://github.com/${config.GITHUB_OWNER}/${ctx.github_repo}/releases`;
        if (program.debug) return task.skip("Disabled in debug mode");
        const releaseName = ctx.tag_name;
        let body = `<h2>Pull Requests:</h2>`;
        body += "<ul>";
        for (const [pr_id, pr] of Object.entries(ctx.pr)) {
          body += `<li><a href="${pr.html_url}"> #${pr_id} | ${pr.title}</a>by ${pr.user.login}</li>`;
        }
        body += ctx.pr_ids.length == 0 ? `<li>None</li>` : "";
        body += "</ul>";
        return createRelease(ctx.github_repo, ctx.tag_name, releaseName, body);
      },
    },
    {
      title: "Sending Slack Notification",
      enabled: () => {
        return !program.debug;
      },
      task: async (ctx, task) => {
        if (program.debug) return task.skip("Disabled in debug mode");
        return new Listr([
          generateReleaseSlackBlockTask(),
          {
            title: "Post in slack channel",
            task: (ctx, task) => {
              return slackClient.chat.postMessage({
                channel: config.SLACK_CHANNEL,
                blocks: ctx.slackMessage,
              });
            },
          },
        ]);
      },
    },
    {
      title: "Changing branch to develop after successful release",
      task: (ctx, task) => {
        task.title = "changing branch";
        if (program.debug) return task.skip("Disable in debug mode");
        return exec("git checkout develop ");
      },
    },
  ],
  { collapse: false }
);

tasks.run().catch((err) => {
  console.log(err);
  process.exit(1);
});
