import chalk from "chalk";

function logInfo(msg) {
    console.log(msg)
};

function logError(msg) {
    console.log(chalk.bold.red(msg))
};

function logDebug(msg) {
    console.log(chalk.dim.italic.grey(msg))
};

const log = {
    info: logInfo,
    error: logError,
    debug: logDebug,
};

export default log;