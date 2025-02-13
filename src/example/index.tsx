import React, { memo } from "react";
import './global.css';
import components from './index.css';

const { View, Text, Fragment } = components;

export default memo(() => {

  return (
    <View className="wrap main">
      <View className="item">1111111</View>
      <View className="item">2222222</View>
      <View className="item">3</View>
      <Fragment>
        {
          [1, 2, 3].map(item => (
            <View className="item" key={item}>
              <Text className="text">{ item }</Text>
            </View>
          ))
        }
      </Fragment>
    </View>
  );
});
