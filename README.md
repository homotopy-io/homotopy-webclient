# homotopy.io


## Build Instructions

First time:

	- `npm install -g yarn`

Subsequent times:

	- in root directory, run `yarn` to install all dependencies and link the included packages together.

Production:

	- in `client` and `core`, run `npm run build`.

Development:

	- in `client` and `core`, run `npm run dev`, which automatically rebuilds when the source changes. In `client`, this also starts a webserver.
