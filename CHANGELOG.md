# Changelog

## v0.1.0

Basic implementation that allows pulling a single `.gitignore` file


## v0.1.2

- Fixed unhandled error in the case no workspace is open


## v0.1.3

- Added icon


## v0.1.4

- Fixed url to github repository
- Added url to github issues
- Exposed a setting named "gitignore.cacheExpirationInterval" that controls how long the `.gitignore` files retrieved from the github repository are stored in cache. Defaults to 3600 seconds.
- Fixed cancellation of the `Add gitignore` command not beeing handled correctly
