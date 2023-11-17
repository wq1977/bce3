export default function (name) {
  var bunyan = require("bunyan");
  var log = bunyan.createLogger({
    name,
    level: "info",
    serializers: bunyan.stdSerializers,
  });
  return log;
}
