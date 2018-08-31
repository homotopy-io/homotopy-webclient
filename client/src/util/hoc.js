import * as React from "react";

export default Wrapper => Component => props =>
  <Wrapper {...props}>
    { ({...result}) => <Component {...result} {...props} /> }
  </Wrapper>;