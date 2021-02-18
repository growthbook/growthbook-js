// tsdx.config.js
module.exports = {
  rollup(config) {
    config.external = (id) => false;
    return config;
  }
}