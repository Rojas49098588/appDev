import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noticeCopy } from '../lib/photoPermission.ts';

test('camera notice offers to ask again while the phone still allows it', () => {
  const c = noticeCopy({ source: 'camera', canAskAgain: true }, false);
  assert.equal(c.title, 'Camera access unavailable');
  assert.equal(c.button, 'Try camera access again');
});

test('after "Don\'t allow" the button sends people to Settings', () => {
  assert.equal(noticeCopy({ source: 'camera', canAskAgain: false }, false).button, 'Open Settings');
  assert.equal(noticeCopy({ source: 'library', canAskAgain: false }, false).button, 'Open Settings');
});

test('library notice uses library wording and the Photos setting', () => {
  const c = noticeCopy({ source: 'library', canAskAgain: true }, false);
  assert.equal(c.title, 'Photo library access unavailable');
  assert.equal(c.button, 'Try photo library access again');
  assert.ok(c.learnMore.some((line) => line.includes('allow Photos')));
});

test('learn more mentions the photo is optional only where it is', () => {
  const optional = (o: boolean) => noticeCopy({ source: 'camera', canAskAgain: true }, o).learnMore.join(' ');
  assert.match(optional(true), /optional/);
  assert.doesNotMatch(optional(false), /optional/);
});
