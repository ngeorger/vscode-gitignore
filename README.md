# gitignore extension for Visual Studio Code

A simple extension for Visual Studio Code that lets you pull `.gitignore` files from the [github/gitignore](https://github.com/github/gitignore) repository.


## Usage

Start command palette <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> and type `Add gitignore`


## Settings

```JavaScript
{
	// Number of seconds the list of `.gitignore` files retrieved from github will be cached
	"gitignore.cacheExpirationInterval": 3600
}
```


## Roadmap

### v0.1
Basic implementation that allows to pull a single `.gitignore` file

### v0.2
Support adding multiple .gitignore files and merge it to a `.gitignore` file


## License

See LICENSE file


## Credits

Icon based on the Git logo by Jason Long
