import * as vscode from 'vscode';
import * as fs from 'fs';
import { join as joinPath } from 'path';

import { Cache } from './cache';
import { GitignoreTemplate, GitignoreOperation, GitignoreOperationType, GitignoreProvider } from './interfaces'
import { GithubGitignoreRepositoryProvider } from './providers/github-gitignore-repository';


class CancellationError extends Error {

}

interface GitignoreQuickPickItem extends vscode.QuickPickItem {
	template: GitignoreTemplate;
}


// Initialize
const config = vscode.workspace.getConfiguration('gitignore');
const cache = new Cache(config.get('cacheExpirationInterval', 3600));

// Create gitignore repository provider
const gitignoreRepository : GitignoreProvider = new GithubGitignoreRepositoryProvider(cache);
//const gitignoreRepository : GitignoreProvider = new GithubGitignoreApiProvider(cache);


/**
 * Resolves the workspace folder by
 * - using the single opened workspace
 * - prompting for the workspace to use when multiple workspaces are open
 */
function resolveWorkspaceFolder(gitIgnoreTemplate: GitignoreTemplate) {
	const folders = vscode.workspace.workspaceFolders;
	// folders being falsy can have two reasons:
	// 1. no folder (workspace) open
	//    --> should never be the case as already handled before
	// 2. the version of vscode does not support the workspaces
	//    --> should never be the case as we require a vscode with support for it
	if (!folders) {
		return Promise.reject(new CancellationError());
	}
	else if(folders.length === 1) {
		return Promise.resolve({template: gitIgnoreTemplate, path: folders[0].uri.fsPath});
	}
	else {
		return vscode.window.showWorkspaceFolderPick().then(folder => {
			if (!folder) {
				return Promise.reject(new CancellationError());
			}
			return Promise.resolve({template: gitIgnoreTemplate, path: folder.uri.fsPath});
		});
	}
}

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
	switch(operation.type) {
		case GitignoreOperationType.Append:
			return vscode.window.showInformationMessage(`Appended ${operation.template.path} to the existing .gitignore in the project root`);
		case GitignoreOperationType.Overwrite:
			return vscode.window.showInformationMessage(`Created .gitignore file in the project root based on ${operation.template.path}`);
		default:
			throw new Error('Unsupported operation');
	}
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function activate(context: vscode.ExtensionContext) {
	console.log('vscode-gitignore: extension is now active!');

	const disposable = vscode.commands.registerCommand('gitignore.addgitignore', () => {
		// Check if workspace open
		if(!vscode.workspace.workspaceFolders) {
			vscode.window.showErrorMessage('No workspace/directory open');
			return;
		}

		Promise.resolve()
			.then(() => {
				// Load templates
				return gitignoreRepository.getTemplates();
			})
			.then(templates => {
				// Let the user pick a gitignore file
				const items = templates.map(t => <GitignoreQuickPickItem>{
					label: t.name,
					description: t.path,
					url: t.download_url,
					template: t
				})
				return vscode.window.showQuickPick(items);

			})
			.then(item => {
				// Resolve the path to the folder where we should write the gitignore file

				// Check if the user picked up a gitignore file fetched from Github
				if(!item) {
					// Cancel
					throw new CancellationError();
				}

				return resolveWorkspaceFolder(item.template);
			})
			.then(({ template, path }) => {
				// Calculate operation
				console.log(`vscode-gitignore: add/append gitignore for directory: ${path}`);
				path = joinPath(path, '.gitignore');

				return new Promise<GitignoreOperation>((resolve, reject) => {
					// Check if file exists
					fs.stat(path, (err) => {
						if (err) {
							// File does not exists -> we are fine to create it
							return resolve({ path, template: template, type: GitignoreOperationType.Overwrite });
						}
						promptForOperation()
							.then(operation => {
								if (!operation) {
									// Cancel
									reject(new CancellationError());
									return;
								}
								const typedString = <keyof typeof GitignoreOperationType>operation.label;
								const type = GitignoreOperationType[typedString];

								resolve({ path, template: template, type });
							});
					});
				});
			})
			.then((operation: GitignoreOperation) => {
				// Store the file on file system
				return gitignoreRepository.download(operation);
			})
			.then((operation) => {
				// Show success message
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
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function deactivate() {
	console.log('vscode-gitignore: extension is now deactivated!');
}
