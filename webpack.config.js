const path = require('path');

module.exports = {
  target: 'node',
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'umd',
    library: '@packt/sequelize-service-model',
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      use: [{
        loader: 'babel-loader',
      }],
    }],
  },
  resolve: {
    alias: {
      'pg-native': 'noop2',
      tedious: 'noop2',
      sqlite3: 'noop2',
      mysql2: 'noop2',
    },
  },
};
