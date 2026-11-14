import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProwConfig, mergeProwConfig, resolveTide } from '../.prow-upstream/src/utils/config.ts';
import { setPlatform } from '../.prow-upstream/src/platform/index.ts';
import { actionsPlatform } from '../.prow-upstream/src/adapters/actions.ts';

// Initialize the parser's logging adapter without dispatching the action or making API calls.
setPlatform(actionsPlatform());
const [orgPath, ...overridePaths] = process.argv.slice(2);
assert.ok(orgPath, 'pass the canonical prow.yaml and the four actual printer overrides');
assert.equal(overridePaths.length, 4, 'all four actual printer overrides are required');
const parse = (path) => parseProwConfig(path, readFileSync(path, 'utf8'));
const org = parse(orgPath);

for (const path of [orgPath, ...overridePaths]) {
  const effective = mergeProwConfig(org, path === orgPath ? {} : parse(path));
  const tide = resolveTide(effective.tide, '', { hasOwners: true });
  assert.equal(effective.hold.label, 'hold');
  assert.equal(effective.blunderbuss.request_count, 2);
  assert.equal(effective.sweep.lookback, '6h');
  assert.deepEqual(tide.labels, ['lgtm', 'approved']);
  assert.deepEqual(resolveTide(effective.tide).labels, ['lgtm']);
  assert.deepEqual(tide.missing_labels, ['do-not-merge/*', 'needs-rebase', 'hold']);
  assert.equal(tide.merge_method, 'squash');
  assert.equal(tide.merge_queue, 'auto');
  assert.equal(tide.merge_on_events, true);
  if (path !== orgPath) {
    assert.deepEqual(effective.labels.area.values, []);
    assert.deepEqual(effective.labels.kind, org.labels.kind);
    assert.deepEqual(effective.labels.triage, org.labels.triage);
    assert.deepEqual(effective.require_matching_label, org.require_matching_label);
  }
  console.log(`Validated production Prow configuration: ${path}`);
}
