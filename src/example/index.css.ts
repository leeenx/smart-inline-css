import { createComponentsBindCss } from "./utils";

export default createComponentsBindCss({
  wrap: {
    width: '100%',
    height: '100vh'
  },
  // item(index: number) {
  //   switch(index) {
  //     case 1:
  //       return { color: 'green' };
  //     case 2:
  //       return { color: 'yellow' };
  //     default:
  //       return { color: 'gray' };
  //   }
  // },
  'item': {
    '&:first-child': {
      color: 'blue',
      'text': {
        color: 'red'
      }
    }
  }
});
