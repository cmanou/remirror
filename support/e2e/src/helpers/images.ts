import { promises } from 'fs';
import looksSame, { createDiff } from 'looks-same';
import { dirname, resolve } from 'path';

import { kebabCase } from '@remirror/core';

const { mkdir, writeFile } = promises;

function tempDir(...paths: string[]) {
  return resolve(__dirname, '../..', '__failed-diffs__', ...paths);
}

function toPng(name: string) {
  return !name.endsWith('.png') ? `${name}.png` : name;
}

function getDiffPaths() {
  const testName = kebabCase(jestCircus.currentTestName.toLowerCase());

  return {
    diff: tempDir(toPng(testName)),
    one: tempDir(toPng(`${testName}_1`)),
    two: tempDir(toPng(`${testName}_2`)),
  };
}

/**
 * Checks that two images are matching
 */
export function imagesMatch(image1: string | Buffer, image2: string | Buffer) {
  return new Promise((resolve, reject) => {
    looksSame(image1, image2, { ignoreCaret: true }, (error, { equal }) => {
      if (equal) {
        resolve(equal);
        return;
      }

      const { diff, one, two } = getDiffPaths();

      mkdir(dirname(diff), { recursive: true })
        .then(() => {
          return Promise.all([writeFile(one, image1), writeFile(two, image2)]);
        })
        .then(() => {
          createDiff(
            {
              reference: image1,
              current: image2,
              diff: diff,
              highlightColor: '#ff00ff',
            },
            (diffError) => {
              if (diffError) {
                console.error('Could not create diff after failing test', diffError.message);
                reject(new Error('Could not create diff after failing test'));
                return;
              }

              reject(error ?? new Error(`Images do not match. Diff created at path ${diff}`));
            },
          );
        });
    });
  });
}
