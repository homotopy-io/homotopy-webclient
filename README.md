# homotopy.io

master: [![CircleCI](https://circleci.com/gh/homotopy-io/homotopy-webclient/tree/master.svg?style=svg)](https://circleci.com/gh/homotopy-io/homotopy-webclient/tree/master)

stable: [![CircleCI](https://circleci.com/gh/homotopy-io/homotopy-webclient/tree/stable.svg?style=svg)](https://circleci.com/gh/homotopy-io/homotopy-webclient/tree/stable)

## DOI

You can cite _homotopy.io_ using the following DOI:

[![DOI](https://zenodo.org/badge/114698457.svg)](https://zenodo.org/badge/latestdoi/114698457)

## License

This work is made available under the CC BY-NC 3.0, Attribution-NonCommercial 3.0 Unported

## Build Instructions

First time:

- `git submodule sync && git submodule update --init`
* `cd homotopy-core && npm install && npm run build`
* `npm install`

Development:

- Run `npm run dev`, which automatically rebuilds when the source changes. This
  also starts a webserver at http://localhost:8080.
  
Deployment:

- (Project collaborators only.) Merge to `stable` and push; this is then automatically deployed.

## Citation

You can cite _homotopy.io_ using the following BiBTeX entry:

    @misc{homotopyio-tool, author = {Lukas Heidemann and Nick Hu and Jamie Vicary}, title = {\emph{homotopy.io}}, year = 2019, doi = {10.5281/zenodo.2540764}, url = {https://doi.org/10.5281/zenodo.2540764} }
