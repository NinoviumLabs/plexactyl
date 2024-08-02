const chalk = require("chalk");
const cluster = require("cluster");

function timestamp() {
  const now = new Date();
  return `${now.toLocaleString()}`;
}

function logWithInfo() {
  const originalLog = console.log;
  console.log = function () {
    const stack = new Error().stack.split("\n");
    const workerId = cluster.isWorker ? `worker` : "master";
    const prefix = chalk.gray.bold(`${workerId}   │   `);
    const args = Array.from(arguments);

    // Process each argument and each line within that argument
    const processedArgs = args.map((arg) =>
      arg
        .toString()
        .split('\n')
        .map((line) => `${prefix}${chalk.white(line)}`)
        .join('\n')
    );

    originalLog.apply(console, processedArgs);
  };
}

module.exports = logWithInfo;
