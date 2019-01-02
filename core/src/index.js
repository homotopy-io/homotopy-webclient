import "babel-polyfill";

export { Generator } from "./generator";
export { Diagram } from "./diagram";
export { Content, Limit, LimitComponent } from "./limit";
export { Monotone } from "./monotone";
export { attachGenerator, attach } from "./attach";
export { SerializeCyclic } from "./serialize_flat";

import * as Geometry from "./layout/geometry";
export { Geometry };
export { default as computeLayout0d } from "./layout/solver0d"; // 0d specialized layout engine
export { default as computeLayout2d } from "./layout/solver2d"; // 2d specialized layout enging
export { default as computeLayout } from "./layout/solver";   // generic layout engine

import * as Boundary from "./boundary";
export { Boundary };

import * as Matches from "./matches";
export { Matches };