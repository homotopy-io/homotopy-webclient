const path = require("path");
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = merge(common, {
  mode: "production",
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: "assets/index.html",
      favicon: "assets/favicon.ico"
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "static" }
      ]
    })
  ],
  node: {
    fs: 'empty'
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].bundle.[contenthash].js",
    globalObject: "this"
  },
  optimization: {
    runtimeChunk: "single",
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all"
        }
      }
    }
  },
  devtool: "source-map"
});
