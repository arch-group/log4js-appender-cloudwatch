// @ts-check
// NOTE: log4js appenders must be written in CommonJS

const { CloudWatchLogs } = require("@aws-sdk/client-cloudwatch-logs");
const { dummyLayout } = require("log4js/lib/layouts");

class LogBuffer {
	constructor(config, onReleaseCallback) {
		this.config = config;
		this._logs = [];
		this._timer = null;
		this._onReleaseCallback = onReleaseCallback;
	}

	/**
	 * Pushes a log message to the internal log buffer.
	 *
	 * @param {string | object} msg - The log message to be pushed. If it's an
	 *     object, it will be converted to a JSON string.
	 *
	 * @param {number} [timestamp=Date.now()] - The timestamp of the log
	 *     message. If not provided, the current timestamp will be used.
	 *
	 * @returns {void}
	 */
	push(msg, timestamp) {
		if (typeof msg === "object") {
			msg = JSON.stringify(msg);
		}
		if (timestamp === undefined) {
			timestamp = Date.now();
		}
		this._logs.push({
			message: msg,
			timestamp: timestamp,
		});

		if (this._logs.length >= this.config.batchSize) {
			this.release();
			return;
		}

		if (this._timer === null) {
			this._timer = globalThis.setTimeout(() => {
				this.release();
			}, this.config.bufferTimeout);
			return;
		}
	}

	/**
	 * Releases the logs and clears the timer.
	 *
	 * @returns {void}
	 */
	release() {
		if (this._timer) {
			globalThis.clearTimeout(this._timer);
			this._timer = null;
		}
		this._onReleaseCallback([...this._logs]);
		this._logs = [];
	}
}

/**
 * TODO:
 * - create async method for appender creation
 * - for now log4js doesn't support async configure module
 *
 * @type {import(".").cloudwatch}
 */
function cloudwatch(config, layout) {
	const cloudwatch = new CloudWatchLogs({
		region: config.region,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
	});

	cloudwatch.describeLogGroups({
		logGroupNamePrefix: config.logGroupName,
	}).then((group) => {
		if (group.logGroups?.length === 0) {
			throw new ConfigError("Log group doesn't exists");
		}
	});

	cloudwatch.describeLogStreams({
		logGroupName: config.logGroupName,
		logStreamNamePrefix: config.logStreamName,
	}).then((streams) => {
		if (streams.logStreams?.length) {
			const stream = streams
				.logStreams
				.find(s => s.logStreamName === config.logStreamName);

			if (stream === undefined) {
				throw new ConfigError("Stream name doesn't exists");
			}
		}
	});

	const buffer = new LogBuffer(config, function bufferReleaseCb(logs) {
		cloudwatch.putLogEvents({
			logEvents: logs,
			logGroupName: config.logGroupName,
			logStreamName: config.logStreamName,
		});
	});

	return function appender(loggingEvent) {
		const msg = layout(loggingEvent);
		buffer.push(msg);
	};
}

module.exports.cloudwatch = cloudwatch;

class ConfigError extends Error {
	name = "ConfigError";
	constructor(cause, msg) {
		super(msg);
		this.cause = cause;
	}
}

module.exports.ConfigError = ConfigError;

/**
 * @type {import("log4js").AppenderModule['configure']}
 */
function configure(config, layouts, _findAppender, _levels) {
	const layout = layouts?.basicLayout ?? dummyLayout;
	const appender = cloudwatch(config, layout);

	return appender;
}

module.exports.configure = configure;
