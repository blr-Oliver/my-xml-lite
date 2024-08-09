import {build} from 'esbuild';
// @formatter:off
import {default as packageJson} from './package.json' with {type: 'json'};
// @formatter:on

const {dependencies, devDependencies} = packageJson;

const sharedConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: false,
  external: Object.keys(dependencies).concat(Object.keys(devDependencies))
};

await build({
  ...sharedConfig,
  platform: 'node',
  format: 'esm',
  outfile: 'build/index.js'
});