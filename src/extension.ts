'use strict';

import * as vscode from 'vscode';

const GitHubApi = require('github');
const fs = require('fs');
const https = require('https');


class CancellationError extends Error {

}

class CacheItem {
	private _value: any;
	private storeDate: Date;

	get value(): any {
		return this._value;
	}

	constructor(value: any) {
		this._value = value;
		this.storeDate = new Date();
	}

	public isExpired(expirationInterval: number): boolean {
		return this.storeDate.getTime() + expirationInterval * 1000 < Date.now();
	}
}

interface GitignoreFile extends vscode.QuickPickItem {
	url: string;
}

class GitignoreRepository {
	private cache: CacheItem;
	/**
	 * Cache expiration intervall in seconds
	 */
	private cacheExpirationInterval: number;

	constructor(private client) {
		let config = vscode.workspace.getConfiguration('gitignore');
		this.cacheExpirationInterval = config.get('cacheExpirationInterval', 3600);
	}

	/**
	 * Get all .gitignore files
	 */
	public getFiles(): Promise<GitignoreFile[]> {
		return new Promise((resolve, reject) => {
			// If cached, return cached content
			if(this.cache && !this.cache.isExpired(this.cacheExpirationInterval)) {
				resolve(this.cache.value);
				return;
			}

			// Download .gitignore files from github
			this.client.repos.getContent({
				user: 'github',
				repo: 'gitignore',
				path: ''
			}, (err, response) => {
				if(err) {
					reject(err.message);
					return;
				}

				let files = response
					.filter(file => {
						return (file.type === 'file' && file.name.endsWith('.gitignore'));
					})
					.map(file => {
						return {
							label: file.name.replace(/\.gitignore/, ''),
							description: file.name,
							url: file.download_url
						}
					});

				// Cache the retrieved gitignore files
				this.cache = new CacheItem(files);

				resolve(files);
			});
		});
	}

	/**
	 * Downloads a .gitignore from the repository to the path passed
	 */
	public download(gitignoreFile: GitignoreFile, path: string): Promise<GitignoreFile> {
		return new Promise((resolve, reject) => {
			let file = fs.createWriteStream(path);
			let request = https.get(gitignoreFile.url, function(response) {
				response.pipe(file);

				file.on('finish', () => {
					file.close(() => {
						resolve(gitignoreFile);
					});
				});
			}).on('error', err => {
				// Delete the file
				fs.unlink(path);
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

export function activate(context: vscode.ExtensionContext) {
	console.log('extension "gitignore" is now active!');

	let disposable = vscode.commands.registerCommand('addgitignore', () => {
		// Check if workspace open
		if(!vscode.workspace.rootPath) {
			vscode.window.showErrorMessage('No workspace directory open');
			return;
		}

		Promise.resolve(vscode.window.showQuickPick(gitignoreRepository.getFiles()))
			.then((file: GitignoreFile) => {
				if(!file) {
					// Cancel
					throw new CancellationError();
				}

				var path = vscode.workspace.rootPath + '/.gitignore';

				return new Promise((resolve, reject) => {
					// Check if file exists
					fs.stat(path, (err, stats) => {
						if(err) {
							// File does not exists -> we are fine to create it
							resolve({ path: path, file: file });
						}
						else {
							reject('.gitignore already exists');
						}
					});
				});
			})
			.then((s: any) => {
				// Store the file on file system
				return gitignoreRepository.download(s.file, s.path);
			})
			.then((file: GitignoreFile) => {
				vscode.window.showInformationMessage(`Added ${file.description} to your project root`);
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
