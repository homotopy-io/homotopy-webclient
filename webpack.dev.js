const webpack = require("webpack");
const path = require("path");
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = merge(common, {
  mode: "development",
  plugins: [
    new webpack.HotModuleReplacementPlugin({}),
    new HtmlWebpackPlugin({
      template: "assets/index.html",
      favicon: "assets/favicon.ico"
    })
  ],
  node: {
    fs: 'empty'
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].bundle.js",
    globalObject: "this"
  },
  devServer: {
    hot: true,
    watchOptions: {
      ignored: ['glpk.js']
    }
  },
  devtool: "eval-source-map"
});
