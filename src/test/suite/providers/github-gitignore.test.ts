import * as assert from 'assert';
import * as fs from 'fs';
import { Writable } from 'stream';

import { Cache } from '../../../cache';
import { GitignoreProvider, GitignoreOperation, GitignoreTemplate, GitignoreOperationType } from '../../../interfaces';
import { GithubGitignoreApiProvider } from '../../../providers/github-gitignore-api';
import { GithubGitignoreRepositoryProvider } from '../../../providers/github-gitignore-repository';

function fileExits(path: string): Promise<boolean> {
	return new Promise((resolve) => {
		fs.stat(path, (err) => {
			if(err) return resolve(false);
			return resolve(true);
		});
	});
}

const providers: GitignoreProvider[] = [
	new GithubGitignoreRepositoryProvider(new Cache(0)),
	new GithubGitignoreApiProvider(new Cache(0)),
];

/**
 * An implementation of a stream.Writable that writes to a string member.
 * This class is designed for unit test purposes only.
 */
class MemoryWritable extends Writable {
	bytesWritten = 0;
	path: string | Buffer = '<memory>';
	pending = false;

	private data = '';

	constructor() {
		super();
	}

	_write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
		this.data += chunk.toString();
		callback();
	}

	close(): void {
		// Do nothing
	}

	public get content() : string {
		return this.data;
	}
}

providers.forEach(provider => {

	suite(provider.constructor.name, () => {
		let templates: GitignoreTemplate[] = [];

		test('can retrieve a list of templates', async () => {
			templates = await provider.getTemplates();

			console.log(templates.length);

			assert(templates.length > 0);
			assert(templates.find(t => t.name === 'Clojure') !== undefined);
		});

		test('can download a template to a file', async () => {
			// TODO: Check content of file
			const path = provider.constructor.name + '.gitignore';

			// Cleanup
			if(fs.existsSync(path)) {
				fs.unlinkSync(path)
			}

			const operation = <GitignoreOperation>{
				template: templates.find(t => t.name === 'Clojure'),
				path: path,
				type: GitignoreOperationType.Overwrite
			};

			await provider.download(operation);

			// Assert
			const fileExists = await fileExits(operation.path);
			assert(fileExists);

			const content = fs.readFileSync(operation.path, {encoding: 'utf8'});
			const lines = content.split(/\r?\n/);

			// Regression test for github issue #XXX
			assert(lines[0] !== 'Leiningen.gitignore')

			assert(lines[0] === 'pom.xml')
			assert(lines[1] === 'pom.xml.asc')
			assert(lines[2] === '*.jar')
		});

		test('can download a root template to a writable stream', async () => {
			const memoryStream = new MemoryWritable();

			const path = provider.constructor.name + '.gitignore';

			const operation = <GitignoreOperation>{
				template: templates.find(t => t.name === 'Clojure'),
				path: path,
				type: GitignoreOperationType.Overwrite
			};

			// Act
			await provider.downloadToStream(operation, memoryStream);

			// Assert
			const content = memoryStream.content;
			const lines = content.split(/\r?\n/);

			// Regression test for github issue #XXX
			assert(lines[0] !== 'Leiningen.gitignore')

			assert(lines[0] === 'pom.xml')
			assert(lines[1] === 'pom.xml.asc')
			assert(lines[2] === '*.jar')

		});

		test('can download global a template to a writable stream', async () => {
			const memoryStream = new MemoryWritable();

			const path = provider.constructor.name + '.gitignore';

			const operation = <GitignoreOperation>{
				template: templates.find(t => t.name === 'Octave'),
				path: path,
				type: GitignoreOperationType.Overwrite
			};

			// Act
			await provider.downloadToStream(operation, memoryStream);

			// Assert
			const content = memoryStream.content;
			const lines = content.split(/\r?\n/);

			// Regression test for github issue #XXX
			assert(lines[0] !== 'Leiningen.gitignore')

			assert(lines[0] === '# Windows default autosave extension')
		});
	});

});
