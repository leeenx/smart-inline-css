import { createComponentsBindCss } from "./utils";

export default createComponentsBindCss({
  wrap: {
    width: '100%',
    height: '100vh',
    backgroundColor: 'white',
    item: {
      '&:first-child': {
        color: 'blue',
        text: {
          color: 'red'
        }
      },
      '&:nth-child(2)': {
        color: 'green',
      }
    }
  },
  main: {
    backgroundColor: 'green',
    item: {
      text: {
        color: 'yellow'
      }
    }
    // item(index, args) {
    //   console.log({ index, args });
    //   return {
    //     backgroundColor: 'gray'
    //   }
    // }
  },
  // item(index: number) {
  //   console.log('------ args', arguments);
  //   switch(index) {
  //     case 1:
  //       return { color: 'green' };
  //     case 2:
  //       return { color: 'yellow' };
  //     default:
  //       return { color: 'gray' };
  //   }
  // },
});
