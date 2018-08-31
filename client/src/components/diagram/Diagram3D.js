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
    this.camera.position.set(0, 1, -3);
    this.camera.lookAt(new THREE.Vector3());
    this.scene.add(this.camera);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.diagramRef.current.appendChild(this.renderer.domElement);

    // Create point light
    this.pointLight = new THREE.PointLight(0xFFFFFF);
    this.pointLight.position.x = 10;
    this.pointLight.position.y = 10;
    this.pointLight.position.z = -10;
    this.scene.add(this.pointLight);

    // Create ambient light
    this.ambientLight = new THREE.AmbientLight(0x444444);
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
      <DiagramContainer ref={this.diagramRef} />
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

    for (let { a, b, c, ab, bc } of findSurfaces(this.diagram, this.props.layout)) {
      this.createSurface(a, b, c, ab, bc);
    }

    // this.createScaffold();
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

  createSurface(a, b, c, ab, bc) {
    let aPosition = this.getPosition(a);
    let bPosition = this.getPosition(b);
    let cPosition = this.getPosition(c);

    let aGenerator = this.getGenerator(a);
    let color = new THREE.Color(aGenerator.color);

    let geometry = new THREE.Geometry();
    geometry.vertices.push(
      aPosition,
      bPosition,
      cPosition
    );

    if ((ab.dir * bc.dir) * (ab.codim - bc.codim) > 0) {
      geometry.faces.push(new THREE.Face3(0, 1, 2));
    } else {
      geometry.faces.push(new THREE.Face3(2, 1, 0));
    }

    geometry.computeVertexNormals();
    geometry.computeFaceNormals();

    let material = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    let surface = new THREE.Mesh(geometry, material);

    this.scene.add(surface);
  }

  getGenerator(point) {
    let diagram = this.diagram;
    let id = Core.Geometry.typeAt(diagram, point).id;
    return this.props.generators[id];
  }

  getPosition(point) {
    let positions = this.props.layout.positions;
    let position = positions.get(point.join(":"));
    return new THREE.Vector3(...position);
  }

}

const findSurfaces = (diagram, layout) => {
  let graph = new Graph();

  for (let { source, target, codim, dir } of layout.edges) {
    graph.addEdge(source, target, { codim, dir });
  }

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
