import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// Download VS Code, unzip it and run the integration test
		await runTests({ extensionDevelopmentPath, extensionTestsPath });

		/**
		 * Use 1.18.0 release for testing (lowers API level supported)
		 * 
		 * WARNING: This won't work with current operating systems
		 * 
		 * Debian 11:
		 * 1) first it will fail with
		 *        error while loading shared libraries: libgconf-2.so.4: cannot open shared object file: No such file or directory
		 *    ==> installing `sudo apt -y install libgconf-2-4` will fix this
		 * 2) then it fails with
		 *    (code:20592): Pango-ERROR **: 18:27:30.534: Harfbuzz version too old (1.4.2)
		 *    ==> giving up here as 1.18.0 is from October 2017
		 */
		// await runTests({
		// 	version: '1.18.0',
		// 	extensionDevelopmentPath,
		// 	extensionTestsPath,
		// });
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();
