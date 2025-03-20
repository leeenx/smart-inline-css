import React, { memo, useEffect, useState } from "react";
import classnames from 'classnames';
import './global.css';
import components from './index.css';

const { View, Text, Fragment, StyleWrap } = components;

const Demo = memo(() => {
  const [isWrap, setIsWrap] = useState(true);
  // useEffect(() => {
  //   setTimeout(() => {
  //     setIsWrap(false);
  //   }, 6000);
  // }, []);
  return (
    <StyleWrap name="demo">
      <View className={classnames({ wrap: true, main: true })}>
        <View className="item xxx" data-item="xx-xx-xx" data-wrap={isWrap}>
          <Text className="text1" data-text="text1-content">
            1111111
            <Text className="text2" data-y="y">
              text2
              <Text className="text3">text3</Text>
            </Text>
            <Text className="text2">
              text2-2
              <Text className="text3">text2-2/text3</Text>
            </Text>
          </Text>
        </View>
        <View className="item">
          2222222
          <View className="text2">
            <Text className="text3">
              <Text className="xxx">xxx</Text>
            </Text>
          </View>
          <Text className="xxx">xxx</Text>
        </View>
        <View className="item">
          3
          <View className="text2">
            <Text className="xxx">xxx</Text>
          </View>
        </View>
        <Fragment>
          {
            [1, 2, 3, 4, 5, 6, 7].map(item => (
              <View className="sibling" key={item}>
                <Text className="text">item-{ item }</Text>
              </View>
            ))
          }
          {/* <View className="sibling">
            <Text className="text">item-1</Text>
          </View>
          <View className="sibling">
            <Text className="text">item-2</Text>
          </View>
          <View className="sibling">
            <Text className="text">item-3</Text>
          </View>
          <View className="sibling">
            <Text className="text">item-4</Text>
          </View>
          <View className="sibling">
            <Text className="text">item-5</Text>
          </View>
          <View className="sibling">
            <Text className="text">item-6</Text>
          </View>
          <View className="sibling">
            <Text className="text">item-7</Text>
          </View> */}
        </Fragment>
      </View>
    </StyleWrap>
  );
});

export default Demo;
