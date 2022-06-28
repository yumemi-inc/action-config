const core = require('@actions/core');
const axios = require('axios');
const dotenv = require('dotenv');

const API_BASE_URL = 'https://api.github.com';
const NODE_ENV = process.env['NODE_ENV'];

// If you want to run it locally, set the environment variables like `$ export GITHUB_TOKEN=<your token>`
const GITHUB_TOKEN = process.env['GITHUB_TOKEN'];

async function run() {
  const input = getInputs();
  const content = await getContent(input.repository, input.ref, input.configPath, input.githubToken);
  const config = dotenv.parse(Buffer.from(content, 'base64'));

  for (const key in config) {
    if (input.asSecrets) {
      core.setSecret(config[key]);
    }
    core.setOutput(key, config[key]);
    console.log(`set output: key=${key}, value=${config[key]}`);
  }
}

function getInputs() {
  if (NODE_ENV == 'local') {
    return {
      configPath: '.github/workflows/.config',
      repository: 'yumemi-inc/action-config',
      ref: '',
      githubToken: GITHUB_TOKEN,
      asSecrets: true,
    };
  }

  return {
    // { required: true } .. an error will occur not only if omitted, but also if an empty string is specified for these inputs
    configPath: core.getInput('config-path', { required: true }), // if an empty string is specified, the default value will not be applied
    repository: core.getInput('repository', { required: true }),
    ref: core.getInput('ref'),
    githubToken: core.getInput('github-token', { required: true }),
    asSecrets: core.getInput('as-secrets', { required: true }) != 'false',
  };
}

async function getContent(repository, ref, contentPath, token) {
  let url = `${API_BASE_URL}/repos/${repository}/contents/${contentPath}`;

  // if omitted, the default branch will be applied
  // https://docs.github.com/ja/rest/repos/contents#get-repository-content
  if (ref) {
    url += `?ref=${ref}`;
  }

  try {
    const res = await axios({
      url: url,
      headers: {
        'Authorization': `token ${token}`,
      },
    });
    return res.data.content;
  } catch (e) {
    let message;
    switch (e.response.status) {
      case 401: {
        message = createErrorMessage(e, 'GitHub token may be wrong.');
        break;
      }
      case 403: {
        message = createErrorMessage(e, 'GitHub token may not have enough permissions.');
        break;
      }
      case 404: {
        message = createErrorMessage(e, 'Unable to access the config file. Review the inputs "config-path", "repository", "ref", "github-token".');
        break;
      }
      default: {
      }
    }
    throw Error(message);
  }
}

function createErrorMessage(e, hint) {
  let message = `GitHub API error (message: ${e.message}).`;
  if (hint) {
    message = `${message} ${hint}`;
  }
  return message;
}

run()
  .catch(error => {
    core.setFailed(error.message);
  });
