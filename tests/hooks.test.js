#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function run(script, env, input = '') {
  return spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env: { ...process.env, ...env },
    input,
    encoding: 'utf8',
  });
}

test('hook compatibility checks', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-hooks-'));
  const home = path.join(temp, 'home');
  const pluginData = path.join(temp, 'plugin-data');
  fs.mkdirSync(home, { recursive: true });

  t.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
  });

  // USERPROFILE alongside HOME: os.homedir() reads USERPROFILE on Windows, HOME on POSIX.
  const codexEnv = {
    HOME: home,
    USERPROFILE: home,
    PLUGIN_DATA: pluginData,
    PONYTAIL_DEFAULT_MODE: 'ultra',
  };
  const codexState = path.join(pluginData, '.ponytail-active');

  await t.test('activates in default mode', () => {
    const result = run('ponytail-activate.js', codexEnv);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(codexState, 'utf8'), 'ultra');
    const output = JSON.parse(result.stdout);
    assert.equal(output.systemMessage, 'PONYTAIL:ULTRA');
    assert.match(
      output.hookSpecificOutput.additionalContext,
      /PONYTAIL MODE ACTIVE — level: ultra/,
    );
  });

  await t.test('mode tracker switches level', () => {
    const result = run(
      'ponytail-mode-tracker.js',
      codexEnv,
      JSON.stringify({ prompt: '@ponytail lite' }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(codexState, 'utf8'), 'lite');
    const output = JSON.parse(result.stdout);
    assert.equal(output.systemMessage, 'PONYTAIL:LITE');
  });

  await t.test('mode tracker disables mode', () => {
    const result = run(
      'ponytail-mode-tracker.js',
      codexEnv,
      JSON.stringify({ prompt: 'normal mode' }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(codexState), false);
    const output = JSON.parse(result.stdout);
    assert.equal(output.systemMessage, 'PONYTAIL:OFF');
  });

  await t.test('activates in default mode (claude environment)', () => {
    const claudeEnv = {
      HOME: home,
      USERPROFILE: home,
      PONYTAIL_DEFAULT_MODE: 'full',
    };
    const result = run('ponytail-activate.js', claudeEnv);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(path.join(home, '.claude', '.ponytail-active'), 'utf8'),
      'full',
    );
  });
});
