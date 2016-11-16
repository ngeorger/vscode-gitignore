import * as vscode from 'vscode';
import {Cache, CacheItem} from './cache';

const GitHubApi = require('github');
const fs = require('fs');
const https = require('https');


class CancellationError extends Error {

}

enum OperationType {
	Append,
	Overwrite
}

interface GitignoreOperation {
	type: OperationType;
	path: string;
	file: GitignoreFile;
}

export interface GitignoreFile extends vscode.QuickPickItem {
	url: string;
}

export class GitignoreRepository {
	private cache: Cache;

	constructor(private client) {
		let config = vscode.workspace.getConfiguration('gitignore');
		this.cache = new Cache(config.get('cacheExpirationInterval', 3600));
	}

	/**
	 * Get all .gitignore files
	 */
	public getFiles(path: string = ''): Thenable<GitignoreFile[]> {
		return new Promise((resolve, reject) => {
			// If cached, return cached content
			let item = this.cache.get('gitignore/' + path);
			if(typeof item !== 'undefined') {
				resolve(item);
				return;
			}

			// Download .gitignore files from github
			this.client.repos.getContent({
				user: 'github',
				repo: 'gitignore',
				path: path
			}, (err, response) => {
				if(err) {
					reject(err.message);
					return;
				}

				console.log(`Github API ratelimit remaining: ${response.meta['x-ratelimit-remaining']}`);

				let files = response
					.filter(file => {
						return (file.type === 'file' && file.name.endsWith('.gitignore'));
					})
					.map(file => {
						return {
							label: file.name.replace(/\.gitignore/, ''),
							description: file.path,
							url: file.download_url
						}
					});

				// Cache the retrieved gitignore files
				this.cache.add(new CacheItem('gitignore/' + path, files));

				resolve(files);
			});
		});
	}

	/**
	 * Downloads a .gitignore from the repository to the path passed
	 */
	public download(operation: GitignoreOperation): Thenable<GitignoreOperation> {
		return new Promise((resolve, reject) => {
			let flags = operation.type === OperationType.Overwrite ? 'w' : 'a';
			let file = fs.createWriteStream(operation.path, {flags: flags});

			// If appending to the existing .gitignore file, write a NEWLINE as seperator
			if(flags === 'a') file.write('\n');

			let request = https.get(operation.file.url, function(response) {
				response.pipe(file);

				file.on('finish', () => {
					file.close(() => {
						resolve(operation);
					});
				});
			}).on('error', err => {
				// Delete the .gitignore file if we created it
				if(flags === 'w') {
					fs.unlink(operation.path);
				}
				reject(err.message);
			});
		});
	}
}


// Create a Github API client
let client = new GitHubApi({
	version: '3.0.0',
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
let gitignoreRepository = new GitignoreRepository(client);


function promptForOperation() {
	return vscode.window.showQuickPick([
		{
			label: 'Append',
			description: 'Append to existing .gitignore file'
		},
		{
			label: 'Overwrite',
			description: 'Overwrite existing .gitignore file'
		}
	]);
}

function showSuccessMessage(operation: GitignoreOperation) {
	switch (operation.type) {
		case OperationType.Append:
			return vscode.window.showInformationMessage(`Appended ${operation.file.description} to the existing .gitignore in the project root`);
		case OperationType.Overwrite:
			return vscode.window.showInformationMessage(`Created .gitignore file in the project root based on ${operation.file.description}`);
		default:
			throw new Error('Unsupported operation');
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('extension "gitignore" is now active!');

	let disposable = vscode.commands.registerCommand('addgitignore', () => {
		// Check if workspace open
		if(!vscode.workspace.rootPath) {
			vscode.window.showErrorMessage('No workspace directory open');
			return;
		}

		// Get lists of .gitignore files from Github
		Promise.all([
			gitignoreRepository.getFiles(),
			gitignoreRepository.getFiles('Global')
		])
		// Merge the two result sets
		.then((result) => {
			let files: GitignoreFile[] = Array.prototype.concat.apply([], result)
				.sort((a, b) => a.label.localeCompare(b.label));

			return vscode.window.showQuickPick(files);
		})
		// Check if a .gitignore file exists
		.then((file: GitignoreFile) => {
			if(!file) {
				// Cancel
				throw new CancellationError();
			}

			var path = vscode.workspace.rootPath + '/.gitignore';

			return new Promise<GitignoreOperation>((resolve, reject) => {
				// Check if file exists
				fs.stat(path, (err, stats) => {
					if(err) {
						// File does not exists -> we are fine to create it
						resolve({ path: path, file: file, type: OperationType.Overwrite });
					}
					else {
						promptForOperation()
							.then(operation => {
								if(!operation) {
									// Cancel
									reject(new CancellationError());
									return;
								}

								resolve({ path: path, file: file, type:  OperationType[operation.label] });
							});
					}
				});
			});
		})
		// Store the file on file system
		.then((operation: GitignoreOperation) => {
			return gitignoreRepository.download(operation);
		})
		// Show success message
		.then((operation) => {
			return showSuccessMessage(operation);
		})
		.catch(reason => {
			if(reason instanceof CancellationError) {
				return;
			}

			vscode.window.showErrorMessage(reason);
		});
	});

	context.subscriptions.push(disposable);
}


// this method is called when your extension is deactivated
export function deactivate() {
}
