'use strict';

import * as vscode from 'vscode';

const GitHubApi = require('github');
const fs = require('fs');
const https = require('https');


interface GitignoreFile extends vscode.QuickPickItem {
	url: string;
}

class GitignoreRepository {
	private cache;
	
	constructor(private client) {
		
	}

	/**
	 * Get all .gitignore files 
	 */
	public getFiles(): Promise<GitignoreFile[]> {
		return new Promise((resolve, reject) => {
			// If cached, return cached content
			if(this.cache) {
				resolve(this.cache);
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

				var files = response
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
				this.cache = files;

				resolve(files);
			});
		});
	}

	/**
	 * Downloads a .gitignore from the repository to the path passed
	 */
	public download(gitignoreFile: GitignoreFile, path: string): Promise<GitignoreFile> {
		return new Promise((resolve, reject) => {
			var file = fs.createWriteStream(path);
			var request = https.get(gitignoreFile.url, function(response) {
				response.pipe(file);

				file.on('finish', () => {
					file.close(() => {
						resolve(gitignoreFile);
					});
				});
			}).on('error', (err) => {
				// Delete the file
				fs.unlink(path);
				reject(err.message);
			});
		});
	}
}


// Create a Github API client
var client = new GitHubApi({
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
var gitignoreRepository = new GitignoreRepository(client);

export function activate(context: vscode.ExtensionContext) {
	console.log('extension "gitignore" is now active!');

	let disposable = vscode.commands.registerCommand('addgitignore', () => {
		Promise.resolve(vscode.window.showQuickPick(gitignoreRepository.getFiles()))
			.then((file: any) => {
				var path = vscode.workspace.rootPath + '/.gitignore';
				console.log(path);

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
			.then((file: any) => {
				vscode.window.showInformationMessage(`Added ${file.description} to your project root`);
			})
			.catch(reason => {
				vscode.window.showErrorMessage(reason);
			});
	});

	context.subscriptions.push(disposable);
}


// this method is called when your extension is deactivated
export function deactivate() {
}
