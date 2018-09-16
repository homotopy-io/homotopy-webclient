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

  componentDidUpdate(props) {
    // Dimensions changed
    let { width, height } = this.props;
    if (height != props.height || width != props.width) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

    // Contents changed
    let { diagram, dimension } = this.props;
    if (diagram != props.diagram || dimension != props.dimension) {
      this.buildScene();
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

  buildScene() {
    // TODO: Remove old scene contents for rerender

    for (let point of this.props.layout.points) {
      // this.createPoint(point);
    }

    for (let { source, target } of this.props.layout.edges) {
      //this.createWire(source, target);
    }

    // this.createSurfaces();

    // this.createScaffold();

    this.createQuads();
  }

  createQuads() {
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

      if (generator.generator.n >= this.diagram.n - 2) {
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
      if (aGenerator.generator.n < this.diagram.n - 2) {
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

    // for (let edge of surface.edges.values()) {
    //   const sourceVec = new THREE.Vector3(...edge.vertices[0].position);
    //   const targetVec = new THREE.Vector3(...edge.vertices[1].position);
    //   const dirVec = targetVec.clone();
    //   dirVec.sub(sourceVec);
    //   const length = dirVec.length();
    //   dirVec.normalize();

    //   let wire = edge.vertices[0].annotation.generator.n == 2 && edge.vertices[1].annotation.generator.n == 2;
    //   let color = 0xFFFFFF;

    //   if (!wire) continue;

    //   const arrow = new THREE.ArrowHelper(dirVec, sourceVec, length, color, 0.05, 0.05);
    //   this.scene.add(arrow);
    // }

    // for (let vertex of surface.vertices.values()) {
    //   let color = [null, 0xFF0000, 0x00FF00, 0x0000FF][vertex.annotation.generator.n];
    //   let sphere = new THREE.Mesh(
    //     new THREE.SphereGeometry(0.1, 4, 4),
    //     new THREE.MeshLambertMaterial({ color })
    //   );

    //   sphere.position.copy(new THREE.Vector3(...vertex.position));
    //   this.scene.add(sphere);
    // }
    
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

        let material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(generator.color),
          side: THREE.DoubleSide
        });

        let mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);

        // let wireGeo = new THREE.WireframeGeometry( geometry ); // or WireframeGeometry( geometry )
        // let wireMat = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 2 } );
        // let wireframe = new THREE.LineSegments( wireGeo, wireMat );
        // this.scene.add( wireframe );
      } else if (codimension == 1) {
        let vertices = getWireVertices(surface, group, this.diagram.n);
        let curve = new THREE.CurvePath();

        for (let i = 0; i < vertices.length - 1; i++) {
          curve.add(new THREE.LineCurve3(
            new THREE.Vector3(...vertices[i].position),
            new THREE.Vector3(...vertices[i + 1].position)
          ));
        }

        let color = new THREE.Color(generator.color);

        let geometry = new THREE.TubeGeometry(curve, vertices.length, 0.05, 8, false, true);
        let material = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
        let wire = new THREE.Mesh(geometry, material);

        this.scene.add(wire);
      } else if (codimension == 0) {
        let color = new THREE.Color(generator.color); 
        let sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 32, 32),
          new THREE.MeshLambertMaterial({ color })
        );

        sphere.position.set(...group.values().next().value.position);
        this.scene.add(sphere);
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
