import React, { memo, useEffect, useState } from "react";
import classnames from 'classnames';
import './global.css';
import components from './index.css';

const { View, Text, Fragment, InlineCssContainer } = components;

const Demo = memo(() => {
  const [isWrap, setIsWrap] = useState(true);
  // useEffect(() => {
  //   setTimeout(() => {
  //     setIsWrap(false);
  //   }, 6000);
  // }, []);
  return (
    <InlineCssContainer name="demo">
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
        {/* <Fragment>
          {
            [1, 2, 3].map(item => (
              <View className="item" key={item}>
                <Text className="text">{ item }</Text>
              </View>
            ))
          }
        </Fragment> */}
      </View>
    </InlineCssContainer>
  );
});

export default Demo;
