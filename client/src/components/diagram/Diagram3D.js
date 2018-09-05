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

import { Geometry } from "~/util/3d/geometry";

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
      this.createPoint(point);
    }

    for (let { source, target } of this.props.layout.edges) {
      this.createWire(source, target);
    }

    this.createSurfaces();

    // this.createScaffold();
  }

  createSurfaces() {
    let geometry = new Geometry(0);
    let indices = new Map();

    // Add points
    for (let point of this.props.layout.points) {
      let generator = this.getGenerator(point);

      if (generator.generator.n < this.diagram.dimension - 2) {
        continue;
      }

      let position = this.getPosition(point);
      indices.set(point.join(":"), geometry.addVertex(
        [position.x, position.y, position.z]
      ));
    }

    // Create edge graph
    let graph = new Graph(p => p.join(":"));

    for (let { source, target, codim, dir } of this.props.layout.edges) {
      graph.addEdge(source, target, { codim, dir });
    }

    // Create triangle faces
    let faces = new Map();

    for (let { a, b, c, ab, bc } of findSurfaces(this.diagram, this.props.layout, graph)) {
      let generator = this.getGenerator(a);
      let id = generator.generator.id;

      if (!faces.has(id)) {
        faces.set(id, []);
      }

      if ((ab.dir * bc.dir) * (ab.codim - bc.codim) <= 0) {
        [a, c] = [c, a];
      }

      let aIndex = indices.get(a.join(":"));
      let bIndex = indices.get(b.join(":"));
      let cIndex = indices.get(c.join(":"));

      faces.get(id).push(...geometry.addSurface(aIndex, bIndex, cIndex));
    }

    // Fix wires and boundary points
    for (let { source, target } of this.props.layout.edges) {
      let sGenerator = this.getGenerator(source);
      let tGenerator = this.getGenerator(target);

      let boundary = (
        this.onBoundary(source) &&
        this.onBoundary(target) &&
        sGenerator.generator.n >= this.diagram.n - 2 &&
        tGenerator.generator.n >= this.diagram.n - 2
      );

      let wire = (
        sGenerator.generator.n >= this.diagram.n - 1 &&
        tGenerator.generator.n >= this.diagram.n - 1
      );

      if (!wire && !boundary) {
        continue;
      }

      let sourceIndex = indices.get(source.join(":"));
      let targetIndex = indices.get(target.join(":"));
      geometry.fixLine(sourceIndex, targetIndex);
    }

    // Optimize
    // geometry.optimize(100);

    // Create geometry
    for (let [id, surfaceFaces] of faces) {
      let generator = this.props.generators[id];
      let surfaceGeometry = new THREE.Geometry();
      surfaceGeometry.vertices.push(...geometry.vertices.map(v => new THREE.Vector3(...v)));
      surfaceGeometry.faces.push(...surfaceFaces.map(face => new THREE.Face3(...face)));
      surfaceGeometry.computeVertexNormals();
      surfaceGeometry.computeFaceNormals();

      let material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(generator.color),
        side: THREE.DoubleSide
      });
      let mesh = new THREE.Mesh(surfaceGeometry, material);
      this.scene.add(mesh);


      let wireGeo = new THREE.WireframeGeometry( surfaceGeometry ); // or WireframeGeometry( geometry )
      let wireMat = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 2 } );
      let wireframe = new THREE.LineSegments( wireGeo, wireMat );
      this.scene.add( wireframe );
    }
  }

  onBoundary(point) {
    const check = (diagram, point) => {
      if (diagram.n == 0) {
        return false;
      }

      let [height, ...rest] = point;
      if (height < 0 || height > diagram.data.length * 2) {
        return true;
      } else {
        return check(diagram.getSlice(height), rest);
      }
    };

    return check(this.diagram, point);
  }

  createScaffold() {
    for (let { source, target } of this.props.layout.edges) {
      const sourceVec = this.getPosition(source);
      const targetVec = this.getPosition(target);
      const dirVec = targetVec.clone();
      dirVec.sub(sourceVec);
      const length = dirVec.length();
      dirVec.normalize();

      const arrow = new THREE.ArrowHelper(dirVec, sourceVec, length, 0xFFFFFF, 0.01, 0.01);
      this.scene.add(arrow);
    }
  }

  createPoint(point) {
    let generator = this.getGenerator(point);

    if (generator.generator.n < this.diagram.n) {
      return;
    }

    let color = new THREE.Color(generator.color); 
    let sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 32, 32),
      new THREE.MeshLambertMaterial({ color })
    );

    sphere.position.copy(this.getPosition(point));
    this.scene.add(sphere);
  }

  createWire(s, t) {
    let sGenerator = this.getGenerator(s);
    let color = new THREE.Color(sGenerator.color);

    if (sGenerator.generator.n < this.diagram.n - 1) {
      return;
    }

    let sPosition = this.getPosition(s);
    let tPosition = this.getPosition(t);

    let path = new THREE.LineCurve3(sPosition, tPosition);
    let geometry = new THREE.TubeGeometry(path, 8, 0.05, 8, false, true);
    let material = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    let wire = new THREE.Mesh(geometry, material);

    this.scene.add(wire);
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

const findSurfaces = (diagram, layout, graph) => {
  // Triangles
  let surfaces = [];
  for (let [a, b, ab] of graph.edges()) {
    let aType = Core.Geometry.typeAt(diagram, a);

    if (aType.n < diagram.n - 2) {
      continue;
    }

    for (let [c, bc] of graph.edgesFrom(b)) {
      surfaces.push({
        a, b, c, ab, bc
      });
    }
  }

  return surfaces;
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
