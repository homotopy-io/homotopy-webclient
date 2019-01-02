# homotopy.io

## License

This work is made available under the CC BY-NC 3.0, Attribution-NonCommercial 3.0 Unported

## Build Instructions

First time:

- `npm install -g yarn`

Subsequent times:

- in root directory, run `yarn` to install all dependencies and link the included packages together.

Production:

- first, run `npm run build` in the `core` directory.
- then, run `npm run build` in the `client` directory.

Development:

- in `client` and `core`, run `npm run dev`, which automatically rebuilds when the source changes. In `client`, this also starts a webserver at http://127.0.0.1:8080.