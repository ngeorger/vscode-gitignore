import * as assert from 'assert';
import * as GitHubApi from 'github';

import * as gitignoreExtension from '../../extension';


suite('GitignoreRepository', () => {

	test('is getting all .gitignore files', () => {

		// Create a Github API client
		const client = new GitHubApi({
			protocol: 'https',
			host: 'api.github.com',
			//debug: true,
			pathPrefix: '',
			timeout: 5000,
			headers: {
				'user-agent': 'vscode-gitignore-extension'
			}
		});

		// Create gitignore repository
		const gitignoreRepository = new gitignoreExtension.GitignoreRepository(client);

		return Promise.all([
			gitignoreRepository.getFiles(),
			gitignoreRepository.getFiles('Global')
		])
		.then((result) => {
			const files: gitignoreExtension.GitignoreFile[] = Array.prototype.concat.apply([], result);

			// From .
			const rootItem = files.find(f => f.label === 'VisualStudio');
			assert.deepStrictEqual(rootItem, {
				description: 'VisualStudio.gitignore',
				label: 'VisualStudio',
				url: 'https://raw.githubusercontent.com/github/gitignore/master/VisualStudio.gitignore',
			});

			// From ./Global
			const globalItem = files.find(f => f.label === 'VisualStudioCode');
			assert.deepStrictEqual(globalItem, {
				label: 'VisualStudioCode',
				description: 'Global/VisualStudioCode.gitignore',
				url: 'https://raw.githubusercontent.com/github/gitignore/master/Global/VisualStudioCode.gitignore'
			});
		});
	});
});
