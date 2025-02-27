const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const isCompress = process.env.COMPRESS === 'yes';

const isDev = process.env.DEV === 'yes';

const entries = { index: './src/lib/index.ts' };

const plugins = [new CleanWebpackPlugin()];

// 测试阶段
if (!isCompress) {
  Object.assign(entries, { index: './src/example/index.tsx' });
  plugins.push(
    new HtmlWebpackPlugin({
      template: './src/index.html',
      scriptLoading: 'blocking',
      chunks: ['index'],
      inject: false
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      scriptLoading: 'blocking',
      chunks: ['example'],
      name: 'example',
      filename: 'example/index.html',
      inject: false
    })
  );
}
module.exports = {
  mode: 'production', // development | production | none
  entry: entries,
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: isDev ? '[name].[chunkhash].js' : '[name].js', // 使用 chunkhash 是为了优化 mpa
    libraryTarget: 'umd',
    library: 'app',
    environment: {
      arrowFunction: false,
      const: false
    },
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.wasm'],
    alias: {
      '~': path.resolve(__dirname, './')
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|ts|jsx|tsx)$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              [
                "@babel/preset-env",
                {
                  "useBuiltIns": "usage",
                  "corejs": "3"
                }
              ],
              "@babel/preset-react",
              "@babel/preset-typescript"
            ],
            "plugins": [
              "@babel/plugin-transform-runtime"
            ]
          }
        },
        exclude: /node_modules/, //排除 node_modules 目录
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|json)$/i,
        exclude: /node_modules/,
        type: 'asset/resource',
        parser: {
          dataurlCondition: {
            maxSize: 8192
          }
        }
      }
    ],
  },
  externals: {
    react: {
      commonjs: 'react',
      commonjs2: 'react',
      root: 'React'
    },
    'react-dom': {
      commonjs: 'react-dom',
      commonjs2: 'react-dom',
      root: 'ReactDOM'
    }
  },
  plugins,
  performance: {
    maxAssetSize: 20000000, // 整数类型（以字节为单位）
	  maxEntrypointSize: 400000, // 整数类型（以字节为单位）
  },
  devServer: {
    compress: true,
    hot: false,
    client: false,
    port: 10086,
  }
};
