import { Octokit } from "@octokit/rest"
import config from "../config.js"
import log from "./logger.js"

export const octokit = new Octokit({
    auth: config.GITHUB_PERSONAL_TOKEN,
    userAgent: "JDV ReleaseBot",
    log: {
        warn: log.error,
        error: log.error,
    }
})

const PR_Cache = new Map();

/**
 * Fetch all Pull Request Metadata by ID
 * https://developer.github.com/v3/pulls/
 * @param repo string: Name of Repo
 * @param id int: Pull Request ID
 * @returns {Promise<any>} Promise containing Pull Request GET response.
 */
export async function fetchPullRequestByID(repo, id) {
    if (!PR_Cache.has(id)) {
        const { data } = await octokit.pulls.get({
            owner: config.GITHUB_OWNER,
            repo: repo,
            pull_number: id,
        });
        PR_Cache.set(id, data)
    }
    return PR_Cache.get(id)
}


export async function fetchOpenPRs(repo) {
    const { data } = await octokit.pulls.list({
        owner: config.GITHUB_OWNER,
        repo: repo,
        state: "open",
    })
    return data
}

/**
 * Given a stdout from git log --oneline, return a List of Pull Request IDs.
 * @param gitLog
 * @returns {[]|*[]}
 */
export function extractPullRequestIDs(gitLog) {
    if (!gitLog) {
        return [];
    }
    const ids = [];
    const mergeCommit = /request #(\d+) from/gm;
    const squashCommit = /\(#(\d+\)$)/gm;
    let matches = gitLog.matchAll(mergeCommit);
    for (const match of matches) {
        ids.push(parseInt(match[1], 10));
    }
    matches = gitLog.matchAll(squashCommit);
    for (const match of matches) {
        ids.push(parseInt(match[1], 10));
    }
    ids.sort();
    console.log(ids)
    return ids;
}

export function createRelease(repo, tagName, name, body) {
    return octokit.repos.createRelease({
        owner: config.GITHUB_OWNER,
        repo: repo,
        tag_name: tagName,
        name: name,
        body: body,
    });
}