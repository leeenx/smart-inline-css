import React, { memo, useEffect, useState } from "react";
import classnames from 'classnames';
import './global.css';
import components from './index.css';

const { View, Text, Fragment } = components;

const Demo = memo(() => {
  const [isWrap, setIsWrap] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      setIsWrap(false);
    }, 3000);
  }, []);
  return (
    <View className={classnames({ wrap: true, main: true })}>
      <View className="item" data-item="xx-xx-xx" data-wrap={isWrap}>
        <Text className="text1" data-text="text1-content">
          1111111
          <Text className="text2">text2</Text>
        </Text>
      </View>
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

export default Demo;
