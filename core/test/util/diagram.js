export const checkDiagram = (t, diagram, ...generators) => {
  for (let [point, generator] of generators) {
    t.equal(
      diagram.getSlice(...point).type.id,
      generator.id,
      `Type at position ${point.join(",")}`
    );
  }
};
