import { createStyle } from "./utils";

export default createStyle({
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
      },
      '&[data-item="xx-xx-xx"]': {
        text3: {
          backgroundColor: 'green',
        }
      },
    }
  },
  main: {
    // backgroundColor: 'green',
    // item: {
    //   'text1': {
    //     color: 'pink'
    //   }
    // },
    // item(index, args) {
    //   console.log('===== index', index, args);
    //   return { color: 'pink' };
    // },
    // test: {
    //   '&-1': {
    //     fontSize: 12
    //   },
    //   'c1 c2 c3': {
    //     fontWeight: 400
    //   },
    //   '&:nth-child(1)': {
    //     color: 'green'
    //   },
    //   '+ test': {
    //     color: 'blue',
    //   },
    //   '+ item': {
    //     color: 'yellow',
    //   },
    //   '~ item': {
    //     fontSize: 0,
    //   },
    //   '[title="hello everyone!"]': {
    //     fontWeight: 900,
    //   },
    //   '[title="a&b"]': {

    //   },
    // },
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
