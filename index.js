#!/usr/bin/env node

import 'dotenv/config'

import {readFile} from "node:fs/promises"
import SimpleGit, { grepQueryBuilder } from "simple-git";
import { Gitlab } from '@gitbeaker/rest';

const git = SimpleGit()

const TAGS = (process.env.TODO_BOT_TAGS || "TODO|FIXME|BUG|HACK").toUpperCase().split("|");
const IGNORED_FILES  = ["README.md"]
const BEFORE_AND_AFTER = 3;
const TODO_BOT_NAME = process.env.TODO_BOT_NAME || "Todo Bot"
const TODO_BOT_COLOR = process.env.TODO_BOT_COLOR || "#bada55"

const TAGS_REGEX = new RegExp(`(${TAGS.join("|")})(:| )`)

const files = await git.grep(grepQueryBuilder(...TAGS), ["--line-number", "--untracked", "--full-name"]);

const finds = Object.values(files.results).flat().filter((find) => !IGNORED_FILES.includes(find.path) && find.preview.match(TAGS_REGEX))

const issues = []

for (const find of finds) {
    const content = await readFile(find.path, {encoding:"utf8"})
    const tag = find.preview.match(TAGS_REGEX)
    const commentText = find.preview.slice(tag.index).replace("-->", "").trim()
    const title = `[${find.path} L${find.line}] ${commentText}`
    const lines = content.trimEnd().split("\n");
    const index = find.line - 1;
    const before = Math.max(index - BEFORE_AND_AFTER, 0)
    const after = Math.min(index + BEFORE_AND_AFTER, lines.length - 1)
    const codeblock = lines.slice(before, after + 1).join("\n").trim()
    const codelanguage = find.path.split(".").pop();
    issues.push({
        title, codeblock, codelanguage,
        line: find.line, path: find.path,
    })
}

const api = new Gitlab({
    token: process.env.TODO_BOT_TOKEN,
    host: process.env.CI_API_V4_URL?.replace("/api/v4", ""),
});


const PROJECT_ID = process.env.CI_PROJECT_ID

const availableLabels = await api.ProjectLabels.all(PROJECT_ID)
const todoBotLabel = availableLabels.find(label => label.name === TODO_BOT_NAME)
if (!todoBotLabel) {
    api.ProjectLabels.create(PROJECT_ID, TODO_BOT_NAME, TODO_BOT_COLOR);
}

const availableIssues = await api.Issues.all({
    projectId: PROJECT_ID,
    labels: TODO_BOT_NAME,
    state: "opened",
})

const issuesTitles = issues.map(i => i.title)
const availableIssuesTitles = availableIssues.map(i => i.title)

const codeButNoIssue = issues.filter(i => !availableIssuesTitles.includes(i.title));
const exisiting = issuesTitles.filter(i => availableIssuesTitles.includes(i));
const issueButNoCode = availableIssues.filter(i => !issuesTitles.includes(i.title));

const issueDescription = (issue) => {
    return `Probbably appeared with commit ${process.env.CI_COMMIT_SHA}.

\`\`\`${issue.codelanguage}
${issue.codeblock}
\`\`\`

[Line in Code](${process.env.CI_PROJECT_URL}/-/blob/main/${issue.path}#L${issue.line})`
}

const tree = (levels) => {
    return levels.map((level, index) => {
        if (index + 1 < levels.length) {
            if (level) {
                return "│  "
            } else {
                return "   "
            }
        } else {
            if (level) {
                return "├──"
            } else {
                return "└──"
            }
        }
    }).join(" ")
}

console.log(`Found <${issues.length}> comments in code!`)

if (codeButNoIssue.length > 0) {
    const hasNext = exisiting.length > 0 || issueButNoCode.length > 0;
    console.log(tree([hasNext]), "Newly created issues:")
    codeButNoIssue.forEach(async (issue, index) => {
        console.log(tree([hasNext, index + 1 < codeButNoIssue.length]), issue.title);
        await api.Issues.create(PROJECT_ID, issue.title, {
            description: issueDescription(issue),
            labels: [TODO_BOT_NAME]
        })
    })
}

if (exisiting.length > 0) {
    console.log(tree([issueButNoCode.length > 0]), "Already existing issues:")
    exisiting.forEach((issue, index) => {
        console.log(tree([issueButNoCode.length > 0, index + 1 < exisiting.length]), issue);
    })
}

if (issueButNoCode.length > 0) {
    console.log(tree([false]), "Just closed issues:")
    issueButNoCode.forEach(async (issue, index) => {
        console.log(tree([false, index + 1 < issueButNoCode.length]), issue.title);
        await api.IssueNotes.create(PROJECT_ID, issue.iid, `Probbably closed with commit ${process.env.CI_COMMIT_SHA}`)
        await api.Issues.edit(PROJECT_ID, issue.iid, {
            stateEvent: "close",
        })
    })
}
