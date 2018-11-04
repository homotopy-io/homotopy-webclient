import * as React from "react";
import styled from "styled-components";
import Spinner from "react-spinkit";
import * as THREE from "three";
import OrbitControls from "three-orbit-controls";
import { connect } from "react-redux";
import * as Core from "homotopy-core";

import compose from "~/util/compose";
import Graph from "~/util/graph";
import withSize from "~/components/misc/Sized";
import withLayout from "~/components/diagram/withLayout";
import { getGenerators } from "~/state/store/signature";

import { Surface } from "~/util/3d/surface";
import { subdivideSurface } from "~/util/3d/subdivision";
import { groupSurface } from "~/util/3d/group";
import { indexBuffer, vertexBuffer } from "~/util/3d/buffers";

export default compose(
  withLayout,
  connect(
    state => ({ generators: getGenerators(state) }),
  ),
  withSize
)(props => props.layout
  ? <Diagram3D {...props} />
  : <Loading {...props} />
);

export class Diagram3D extends React.Component {

  constructor(props) {
    super(props);
    this.objects = [];
    this.materials = new Map();
    this.diagramRef = React.createRef();
  }

  componentDidMount() {
    let { width, height } = this.props;

    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    this.camera.position.set(0, 0, -10);
    this.camera.lookAt(new THREE.Vector3());
    this.scene.add(this.camera);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.diagramRef.current.appendChild(this.renderer.domElement);

    // Create point light
    this.pointLight = new THREE.PointLight(0xFFFFFF);
    this.pointLight.position.x = 20;
    this.pointLight.position.y = 20;
    this.pointLight.position.z = -20;
    this.scene.add(this.pointLight);

    // Create ambient light
    this.ambientLight = new THREE.AmbientLight(0x666666);
    this.scene.add(this.ambientLight);

    // Create controls
    this.controls = new (OrbitControls(THREE))(this.camera, this.renderer.domElement);

    // Build the scene
    this.buildScene();

    // Start the rendering loop
    this.startLoop();
  }

  componentDidUpdate(oldProps) {
    // Dimensions changed
    let { width, height } = this.props;
    if (height != oldProps.height || width != oldProps.width) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

    // Contents changed
    let { diagram, dimension, slices, generators } = this.props;
    
    if (
      diagram !== oldProps.diagram ||
      dimension !== oldProps.dimension ||
      slices !== oldProps.slices
    ) {
      this.buildScene();
    } else if (generators !== oldProps.generators) {
      for (let [id, material] of this.materials) {
        material.color.set(new THREE.Color(generators[id].color));
      }
    }
  }

  componentWillUnmount() {
    this.stopLoop();
    this.renderer.forceContextLoss();
  }

  get diagram() {
    return this.props.diagram.getSlice(...this.props.slice);
  }

  render() {
    return (
      <DiagramContainer innerRef={this.diagramRef} />
    );
  }

  renderScene() {
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.renderScene.bind(this));
  }

  startLoop() {
    if (!this.animationFrame) {
      this.animationFrame = requestAnimationFrame(this.renderScene.bind(this));
    }
  }

  stopLoop() {
    cancelAnimationFrame(this.animationFrame);
  }

  getMaterial(generator) {
    const id = generator.generator.id;

    if (!this.materials.has(id)) {
      let material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(generator.color),
        side: THREE.DoubleSide
      });

      this.materials.set(id, material);
    }

    return this.materials.get(id);
  }

  buildScene() {
    // Remove all previous objects from the scene
    for (let object of this.objects) {
      this.scene.remove(object);
    }

    // Create edge graph
    let graph = new Graph(p => p.join(":"));
    for (let { source, target, codim, dir } of this.props.layout.edges) {
      graph.addEdge(source, target, { codim, dir });
    }

    // Obtain quads
    let quads = [];

    for (let [a, b, ab] of graph.edges()) {
      for (let [c, ac] of graph.edgesFrom(a)) {
        for (let [d, bd] of graph.edgesFrom(b)) {
          let cd = graph.getEdge(c, d);

          if (!cd || b.join(":") == c.join(":")) {
            continue;
          }

          quads.push({ a, b, c, d, ab, ac, bd, cd });
        }
      }
    }

    let vertices = [];
    let annotations = [];
    let pointIndices = new Map();
    let cells = [];

    for (let point of this.props.layout.points) {
      let generator = this.getGenerator(point);

      if (generator.generator.n >= this.props.dimension - 2) {
        pointIndices.set(point.join(":"), vertices.length);
        vertices.push(this.getPosition(point));
        annotations.push(generator);
      }
    }

    // Render quads
    for (let quad of quads) {
      let ordinary = (
        quad.ab.codim == 0 &&
        quad.cd.codim == 0 &&
        quad.ac.codim == 1 &&
        quad.bd.codim == 1
      );

      let expand = (
        quad.ab.codim == 0 &&
        quad.ac.codim == 0 &&
        quad.bd.codim == 1 &&
        quad.cd.codim == 1 &&
        quad.bd.dir > 0
      );

      let contract = (
        quad.ab.codim == 1 &&
        quad.ac.codim == 1 &&
        quad.bd.codim == 0 &&
        quad.cd.codim == 0 &&
        quad.ab.dir > 0
      );

      if (!ordinary && !expand && !contract) {
        continue;
      }

      let { a, b, c, d } = quad;

      let aGenerator = this.getGenerator(a);
      if (aGenerator.generator.n < this.props.dimension - 2) {
        continue;
      }

      if (ordinary) {
        if (quad.ab.dir < 0) {
          [a, b, c, d] = [b, a, d, c];
        }

        if (quad.ac.dir < 0) {
          [a, b, c, d] = [c, d, a, b];
        }

      }

      if (contract) {
        if (quad.bd.dir > 0) {
          [a, b, c, d] = [a, c, b, d];
        }
      }

      if (expand) {
        if (quad.ab.dir < 0) {
          [a, b, c, d] = [d, b, c, a];
        }
      }

      cells.push([
        pointIndices.get(a.join(":")),
        pointIndices.get(b.join(":")),
        pointIndices.get(d.join(":")),
        pointIndices.get(c.join(":"))
      ]);
    }

    let merge = (...generators) => {
      generators.sort((a, b) => a.generator.n - b.generator.n);
      return generators[0];
    };

    let surface = Surface.fromCells(vertices.map(v => [v.x, v.y, v.z]), cells, annotations);
    surface = subdivideSurface(surface, merge, merge);
    surface = subdivideSurface(surface, merge, merge);
    surface = subdivideSurface(surface, merge, merge);
    
    let groups = groupSurface(surface, (a, b) => a.generator.n == b.generator.n);

    for (let group of groups) {
      let generator = group.values().next().value.annotation;
      let codimension = this.diagram.n - generator.generator.n;

      if (codimension == 2) {
        let filter = (...vs) => vs.some(v => group.has(v));

        let bufferGeometry = new THREE.BufferGeometry();
        bufferGeometry.setIndex(new THREE.BufferAttribute(indexBuffer(surface, filter), 3));
        bufferGeometry.addAttribute("position", new THREE.BufferAttribute(vertexBuffer(surface), 3));
        bufferGeometry.computeVertexNormals();
        bufferGeometry.computeFaceNormals();

        let geometry = new THREE.Geometry();
        geometry.fromBufferGeometry(bufferGeometry);
        geometry.computeVertexNormals();
        geometry.computeFaceNormals();

        let material = this.getMaterial(generator);

        let mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
        this.objects.push(mesh);
      } else if (codimension == 1) {
        let vertices = getWireVertices(surface, group, this.diagram.n);
        let curve = new THREE.CurvePath();

        for (let i = 0; i < vertices.length - 1; i++) {
          curve.add(new THREE.LineCurve3(
            new THREE.Vector3(...vertices[i].position),
            new THREE.Vector3(...vertices[i + 1].position)
          ));
        }

        let geometry = new THREE.TubeGeometry(curve, vertices.length, 0.05, 8, false, true);
        let material = this.getMaterial(generator)
        let wire = new THREE.Mesh(geometry, material);

        this.scene.add(wire);
        this.objects.push(wire);
      } else if (codimension == 0) {
        let sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 32, 32),
          this.getMaterial(generator)
        );

        sphere.position.set(...group.values().next().value.position);
        this.scene.add(sphere);
        this.objects.push(sphere);
      }
    }

  }

  createScaffold() {
    for (let { source, target } of this.props.layout.edges) {
      const sourceVec = this.getPosition(source);
      const targetVec = this.getPosition(target);
      const dirVec = targetVec.clone();
      dirVec.sub(sourceVec);
      const length = dirVec.length();
      dirVec.normalize();

      const arrow = new THREE.ArrowHelper(dirVec, sourceVec, length, 0xFFFFFF, 0.05, 0.05);
      this.scene.add(arrow);
    }
  }

  getGenerator(point) {
    let diagram = this.diagram;
    let id = Core.Geometry.typeAt(diagram, point).id;
    return this.props.generators[id];
  }

  getPosition(point) {
    let positions = this.props.layout.positions;
    let position = positions.get(point.join(":")).slice();

    while (position.length < 3) {
      position.unshift(0);
    }

    return new THREE.Vector3(position[2], position[1], position[0]);
  }

}


const getWireVertices = (surface, group, dimension) => {
  let edgesFrom = new Map();
  let edgesTo = new Map();

  let condition = vertex => (
    group.has(vertex) ||
    vertex.annotation.generator.n == dimension
  );

  for (let vertex of group) {
    for (let edge of vertex.edges.values()) {
      if (condition(edge.vertices[0]) && condition(edge.vertices[1])) {
        edgesFrom.set(edge.vertices[0], edge.vertices[1]);
        edgesTo.set(edge.vertices[1], edge.vertices[0]);
      }
    }
  }

  // Find first vertex
  let first = null;

  for (let vertex of edgesFrom.keys()) {
    if (!edgesTo.has(vertex)) {
      first = vertex;
      break;
    }
  }

  // Now traverse in order
  let current = first;
  let wire = [current];

  while (edgesFrom.has(current)) {
    current = edgesFrom.get(current);
    wire.push(current);
  }

  return wire;
};

export const Loading = () =>
  <LoadingWrapper>
    <Spinner />
  </LoadingWrapper>;

const DiagramContainer = styled.div`
  position: absolute;
`;

const LoadingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
`;
