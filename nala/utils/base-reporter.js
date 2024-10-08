/* eslint-disable max-len, class-methods-use-this, no-empty-function, no-console */
import generateA11yReport from './a11y-report.js';

const fs = require('fs').promises;
const path = require('path');

const { sendSlackMessage } = require('./slack.js');

// Playwright will include ANSI color characters and regex from below
// https://github.com/microsoft/playwright/issues/13522
// https://github.com/chalk/ansi-regex/blob/main/index.js#L3

const pattern = [
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
].join('|');

const ansiRegex = new RegExp(pattern, 'g');

// limit failed status
const failedStatus = ['failed', 'flaky', 'timedOut', 'interrupted'];

function stripAnsi(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(ansiRegex, '');
}

class BaseReporter {
  constructor(options) {
    this.options = options;
    this.results = [];
    this.passedTests = 0;
    this.failedTests = 0;
    this.skippedTests = 0;
  }

  onBegin(config, suite) {
    this.config = config;
    this.rootSuite = suite;
    this.globalAccessibilityResults = [];
  }

  async onTestEnd(test, result) {
    const { title, retries, _projectId } = test;
    const {
      name, tags, url, browser, env, branch, repo,
    } = this.parseTestTitle(title, _projectId);
    const {
      status,
      duration,
      error: { message: errorMessage, value: errorValue, stack: errorStack } = {},
      retry,
    } = result;

    const attachments = result.attachments.filter((att) => att.name === 'Accessibility Test Results');
    
    if (attachments.length > 0) {
      const attachment = attachments[0];
      const attachedData = JSON.parse(attachment.body.toString('utf-8'));
      this.globalAccessibilityResults.push(attachedData);
    }

    if (retry < retries && status === 'failed') {
      return;
    }
    this.results.push({
      title,
      name,
      tags,
      url,
      env,
      browser,
      branch,
      repo,
      status: failedStatus.includes(status) ? 'failed' : status,
      errorMessage: stripAnsi(errorMessage),
      errorValue,
      errorStack: stripAnsi(errorStack),
      stdout: test.stdout,
      stderr: test.stderr,
      duration,
      retry,
    });
    if (status === 'passed') {
      this.passedTests += 1;
    } else if (failedStatus.includes(status)) {
      this.failedTests += 1;
    } else if (status === 'skipped') {
      this.skippedTests += 1;
    }
  }

  async onEnd() {
    const summary = this.printResultSummary();
    const resultSummary = { summary };

    const resultPath = this.getA11yResultPath();
    const fullResultPath = path.resolve(resultPath);

    try {
      const dirExists = await fs.stat(fullResultPath)
        .then(() => true)
        .catch(() => false);
  
      if (!dirExists) {
        console.log('Directory does not exist. Creating:', fullResultPath);
        await fs.mkdir(fullResultPath, { recursive: true });
        console.log('Directory created successfully:', fullResultPath);
      } else {
        console.log('Directory already exists:', fullResultPath);
      }
    } catch (error) {
      console.error('Error creating or checking directory:', error.message);
      return;
    }
    if (this.globalAccessibilityResults.length > 0) {
      console.log(`Found total ${this.globalAccessibilityResults.length} Accessibility rules voilation in this test run`);
      await generateA11yReport(this.globalAccessibilityResults, resultPath);
      console.log(`Accessibility report saved at: ${resultPath}`);
    } else {
      console.info('No Accessibility test violations to report.');
    }

    if (process.env.SLACK_WH) {
      try {
        await sendSlackMessage(process.env.SLACK_WH, resultSummary);
      } catch (error) {
        console.log('----Failed to publish result to slack channel----');
      }
    }
  }

  printResultSummary() {
    const totalTests = this.results.length;
    const passPercentage = ((this.passedTests / totalTests) * 100).toFixed(2);
    const failPercentage = ((this.failedTests / totalTests) * 100).toFixed(2);
    const miloLibs = process.env.MILO_LIBS || '';
    const prBranchUrl = process.env.PR_BRANCH_LIVE_URL ? (process.env.PR_BRANCH_LIVE_URL + miloLibs) : undefined;
    const projectBaseUrl = this.config.projects[0].use.baseURL;
    const envURL = prBranchUrl || projectBaseUrl;

    let exeEnv = 'Local Environment';
    let runUrl = 'Local Environment';
    let runName = 'Nala Local Run';

    if (process.env.GITHUB_ACTIONS === 'true') {
      exeEnv = 'GitHub Actions Environment';
      const repo = process.env.GITHUB_REPOSITORY;
      const runId = process.env.GITHUB_RUN_ID;
      const prNumber = process.env.GITHUB_REF.split('/')[2];
      runUrl = `https://github.com/${repo}/actions/runs/${runId}`;
      runName = `${process.env.WORKFLOW_NAME ? (process.env.WORKFLOW_NAME || 'Nala Daily Run') : 'Nala PR Run'} (${prNumber})`;
    } else if (process.env.CIRCLECI) {
      exeEnv = 'CircleCI Environment';
      const workflowId = process.env.CIRCLE_WORKFLOW_ID;
      const jobNumber = process.env.CIRCLE_BUILD_NUM;
      runUrl = `https://app.circle.ci.adobe.com/pipelines/github/wcms/nala/${jobNumber}/workflows/${workflowId}/jobs/${jobNumber}`;
      runName = 'Nala CircleCI/Stage Run';
    }

    const summary = `
    \x1b[1m\x1b[34m---------Nala Test Run Summary------------\x1b[0m
    \x1b[1m\x1b[33m# Total Test executed:\x1b[0m \x1b[32m${totalTests}\x1b[0m
    \x1b[1m\x1b[33m# Test Pass          :\x1b[0m \x1b[32m${this.passedTests} (${passPercentage}%)\x1b[0m
    \x1b[1m\x1b[33m# Test Fail          :\x1b[0m \x1b[31m${this.failedTests} (${failPercentage}%)\x1b[0m
    \x1b[1m\x1b[33m# Test Skipped       :\x1b[0m \x1b[32m${this.skippedTests}\x1b[0m
    \x1b[1m\x1b[33m** Application URL  :\x1b[0m \x1b[32m${envURL}\x1b[0m
    \x1b[1m\x1b[33m** Executed on      :\x1b[0m \x1b[32m${exeEnv}\x1b[0m
    \x1b[1m\x1b[33m** Execution details:\x1b[0m \x1b[32m${runUrl}\x1b[0m
    \x1b[1m\x1b[33m** Workflow name    :\x1b[0m \x1b[32m${runName}\x1b[0m`;

    console.log(summary);

    if (this.failedTests > 0) {
      console.log('-------- Test Failures --------');
      this.results
        .filter((result) => result.status === 'failed')
        .forEach((failedTest) => {
          console.log(`Test: ${failedTest.title.split('@')[1]}`);
          // console.log(`Error Message: ${failedTest.errorMessage}`);
          console.log(`Error Stack: ${failedTest.errorStack}`);
          console.log('--------------------------------------------\n');
        });
    }
    return summary;
  }

  /**
  This method takes test title and projectId strings and then processes it .
  @param {string, string} str - The input string to be processed
  @returns {'name', 'tags', 'url', 'browser', 'env', 'branch' and 'repo'}
  */
  parseTestTitle(title, projectId) {
    let env = 'live';
    let browser = 'chrome';
    let branch;
    let repo;
    let url;

    const titleParts = title.split('@');
    const name = titleParts[1].trim();
    const tags = titleParts.slice(2).map((tag) => tag.trim());

    const projectConfig = this.config.projects.find((project) => project.name === projectId);

    // Get baseURL from project config
    if (projectConfig?.use?.baseURL) {
      ({ baseURL: url, defaultBrowserType: browser } = projectConfig.use);
    } else if (this.config.baseURL) {
      url = this.config.baseURL;
    }
    // Get environment from baseURL
    if (url.includes('prod')) {
      env = 'prod';
    } else if (url.includes('stage')) {
      env = 'stage';
    }
    // Get branch and repo from baseURL
    if (url.includes('localhost')) {
      branch = 'local';
      repo = 'local';
    } else if (url && url !== 'unknown') {
      const urlParts = url.split('/');
      const branchAndRepo = urlParts[urlParts.length - 1];
      [branch, repo] = branchAndRepo.split('--');
    } else {
      console.warn('No valid URL found, setting branch and repo to default values.');
    }

    return {
      name, tags, url, browser, env, branch, repo,
    };
  }

  async persistData() {}

  printPersistingOption() {
    if (this.options?.persist) {
      console.log(
        `Persisting results using ${this.options.persist?.type} to ${this.options.persist?.path}`,
      );
    } else {
      console.log('Not persisting data');
    }
    this.branch = process.env.LOCAL_TEST_LIVE_URL;
  }

  getPersistedDataObject() {
    const gitBranch = process.env.GITHUB_REF_NAME ?? 'local';

    // strip out git owner since it can usually be too long to show on the ui
    const [, gitRepo] = /[A-Za-z0-9_.-]+\/([A-Za-z0-9_.-]+)/.exec(
      process.env.GITHUB_REPOSITORY,
    ) ?? [null, 'local'];

    const currTime = new Date();
    return {
      gitBranch,
      gitRepo,
      results: this.results,
      timestamp: currTime,
    };
  }

  // helper function to determine a11y report location.
  getA11yResultPath() {
    const isGitHubAction = process.env.GITHUB_ACTIONS === 'true';
    const isPullRequest = process.env.GITHUB_REF && process.env.GITHUB_REF.includes('pull');

    if (isGitHubAction) {
      console.log('Getting the result path:');
      if (isPullRequest) {
        return './nala-report-a11y/pr-reports';
      }
      return './nala-report-a11y/manual-reports';
    }
    return './test-results';
  }
}
export default BaseReporter;
