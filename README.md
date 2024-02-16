# homotopy.io

![master](https://github.com/homotopy-io/homotopy-webclient/workflows/ci.yml/badge.svg)

## DOI

You can cite _homotopy.io_ using the following DOI:

[![DOI](https://zenodo.org/badge/114698457.svg)](https://zenodo.org/badge/latestdoi/114698457)

## License

This work is made available under the CC BY-NC 3.0, Attribution-NonCommercial 3.0 Unported

## Build Instructions

First time:

- `git submodule sync`
- `git submodule update --init`
- `cd homotopy-core`
- `npm install`
- `npm run build`
- `cd ..`
- `npm install`

Development:

- Run `npm run dev`, which automatically rebuilds when the source changes. This
  also starts a webserver at http://localhost:8080.

Deployment:

- (Project collaborators only.) Merge to `master` and push; this is then automatically deployed.

## Citation

You can cite _homotopy.io_ using the following BiBTeX entry:

    @misc{homotopyio-tool, author = {Lukas Heidemann and Nick Hu and Jamie Vicary}, title = {\emph{homotopy.io}}, year = 2019, doi = {10.5281/zenodo.2540764}, url = {https://doi.org/10.5281/zenodo.2540764} }

## Community

Have questions about homotopy.io? Come and chat to us! We can be found in the [[matrix]](https://matrix.org/) room [`#homotopy:matrix.org`](https://matrix.to/#/#homotopy:matrix.org), which is bridged to [Gitter](https://gitter.im/homotopyio/community) and [`#homotopy` on freenode.net](https://webchat.freenode.net/#homotopy).
