import * as core from '@actions/core';
import { HttpClient } from '@actions/http-client';

const USER_AGENT = 'jira-version-action';

interface JiraVersionPayload {
  name: string;
  description?: string;
  project: string;
  released?: boolean;
}

interface JiraVersion {
  id: string;
  self: string;
  name: string;
  [key: string]: any;
}

async function getProjectVersions(client: HttpClient, baseUrl: string, projectKey: string, headers: any): Promise<JiraVersion[]> {
  const url = `${baseUrl}/rest/api/3/project/${projectKey}/versions`;
  const resp = await client.get(url, headers);
  const body = await resp.readBody();
  const status = resp.message.statusCode ?? 0;
  
  if (status !== 200) {
    throw new Error(`Failed to fetch versions: HTTP ${status}`);
  }
  
  return JSON.parse(body);
}

async function findVersion(client: HttpClient, baseUrl: string, projectKey: string, versionName: string, headers: any): Promise<JiraVersion | null> {
  const versions = await getProjectVersions(client, baseUrl, projectKey, headers);
  return versions.find(v => v.name === versionName) || null;
}

async function run(): Promise<void> {
  try {
    const jiraBaseUrl = core.getInput('jira-base-url', { required: true });
    const jiraProjectKey = core.getInput('jira-project-key', { required: true });
    const jiraUserEmail = core.getInput('jira-user-email', { required: true });
    const jiraApiToken = core.getInput('jira-api-token', { required: true });
    const versionName = core.getInput('version-name', { required: true });
    const versionDescription = core.getInput('version-description') || '';
    const released = core.getBooleanInput('released', { required: false });
    const checkIfExists = core.getBooleanInput('check-if-exists', { required: false });

    const auth = Buffer.from(`${jiraUserEmail}:${jiraApiToken}`).toString('base64');
    const url = `${jiraBaseUrl}/rest/api/3/version`;

    // Mask secrets so they never appear in logs
    core.setSecret(jiraApiToken);
    core.setSecret(jiraUserEmail);
    core.debug('Secrets masked in logs');

    core.debug(`Initializing HTTP client for ${jiraBaseUrl}`);
    const client = new HttpClient(USER_AGENT);
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Check if version exists if flag is enabled
    if (checkIfExists) {
      const existingVersion = await findVersion(client, jiraBaseUrl, jiraProjectKey, versionName, headers);
      if (existingVersion) {
        core.info(`Version "${versionName}" already exists in project "${jiraProjectKey}"`);
        core.setOutput('version-id', existingVersion.id);
        core.setOutput('version-url', existingVersion.self);
        return;
      }
    }

    core.info(`Creating version "${versionName}" in project "${jiraProjectKey}"...`);

    const payload: JiraVersionPayload = {
      name: versionName,
      description: versionDescription,
      project: jiraProjectKey,
      released
    };

    // Helper to retry on 429 with exponential backoff
    async function postWithRetry(url: string, bodyStr: string, headers: any, maxRetries = 3) {
      let attempt = 0;
      while (true) {
        attempt++;
        const resp = await client.post(url, bodyStr, headers);
        const status = resp.message.statusCode ?? 0;
        const respBody = await resp.readBody();
        
        if (status === 429 && attempt <= maxRetries) {
          const waitMs = Math.pow(2, attempt) * 1000;
          core.warning(`Rate limit exceeded, retrying in ${waitMs}ms (${attempt}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        
        return { status, body: respBody };
      }
    }
 
    const result = await postWithRetry(url, JSON.stringify(payload), headers, 3);

    if (result.status < 200 || result.status >= 300) {
      core.error('Failed to create Jira version:');
      core.error(`- Status: HTTP ${result.status}`);
      try {
        const parsed = JSON.parse(result.body);
        core.error('- Error details:');
        core.error(JSON.stringify(parsed, null, 2));
      } catch (e) {
        core.error('- Raw response:');
        core.error(result.body);
      }
      core.setFailed(`Version creation failed with HTTP ${result.status}`);
      return;
    }

    let data: any;
    try {
      data = JSON.parse(result.body);
    } catch (e) {
      core.setFailed('Failed to parse Jira response as JSON.');
      return;
    }

    core.info(`Version "${data.name}" created successfully`);
    core.setOutput('version-id', data.id);
    core.setOutput('version-url', data.self);

  } catch (error: any) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

run();
