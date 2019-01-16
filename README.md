# homotopy.io

master: [![CircleCI](https://circleci.com/gh/homotopy-io/webclient/tree/master.svg?style=svg)](https://circleci.com/gh/homotopy-io/webclient/tree/master)

stable: [![CircleCI](https://circleci.com/gh/homotopy-io/webclient/tree/stable.svg?style=svg)](https://circleci.com/gh/homotopy-io/webclient/tree/stable)

## DOI

You can cite _homotopy.io_ using the following DOI:

[![DOI](https://zenodo.org/badge/114698457.svg)](https://zenodo.org/badge/latestdoi/114698457)

## License

This work is made available under the CC BY-NC 3.0, Attribution-NonCommercial 3.0 Unported

## Build Instructions

First time:

- `npm install -g yarn`

Subsequent times:

- In root directory, run `yarn` to install all dependencies and link the included packages together.

Development:

- In `client` and `core`, run `npm run dev`, which automatically rebuilds when
  the source changes. In `client`, this also starts a webserver at
  http://localhost:8080.
  
Deployment:

- (Project collaborators only.) Merge to `stable` and push; this is then automatically deployed.

## Citation

You can cite _homotopy.io_ using the following BiBTeX entry:

    @misc{homotopyio-tool, author = {Lukas Heidemann, Nick Hu and Jamie Vicary}, title = {\emph{homotopy.io}}, year = 2019, doi = {10.5281/zenodo.2540764}, url = {https://doi.org/10.5281/zenodo.2540764} }
