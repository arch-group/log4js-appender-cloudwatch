// @ts-check
import assert from "node:assert";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import { CloudWatchLogs } from "@aws-sdk/client-cloudwatch-logs";

import { dummyLayout } from "log4js/lib/layouts.js";
import Level from "log4js/lib/levels.js";

import { cloudwatch } from "./index.js";

// NOTE: to run this test node v20.6+ is required for native .env loader
// nvm install && nvm use

/**
 * @type {import("./index.d.ts").Config}
 */
const config = {
	accessKeyId: process.env.accessKeyId,
	secretAccessKey: process.env.secretAccessKey,
	region: "eu-central-1",
	logGroupName: "foo",
	logStreamName: "bar",
	batchSize: 10,
	bufferTimeout: 1_000,
};

/** @type {import("log4js").LoggingEvent} */
const logEvent = {
	categoryName: "default",
	startTime: new Date(),
	data: ["test"],
	pid: 0,
	fileName: "",
	lineNumber: 0,
	columnNumber: 0,
	callStack: "",
	functionName: "",
	context: null,
	serialise: () => "",
	level: new Level(20000, "INFO", "green"),
};

const cloudwatchClient = new CloudWatchLogs({
	region: config.region,
	credentials: {
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
	},
});

test("Fill batch size", async () => {
	const appender = cloudwatch(config, dummyLayout);
	const startTime = Date.now();

	// NOTE: batch is pushed after 10 events
	for (let i = 0; i < 10; i++) {
		appender(logEvent);
	}
	// NOTE: wait for 1 second to ensure all events are processed
	await sleep(1_000);

	// NOTE: fetch log events, if events are not appearing, increase sleep duration
	const data = await cloudwatchClient.getLogEvents({
		startTime: startTime,
		logStreamName: config.logStreamName,
		logGroupName: config.logGroupName,
	});
	assert.equal(data.events?.length, 10);

	for (const e of data.events) {
		assert.deepEqual(e.message, "test");
	}
});

test("Wait for buffer timeout", async () => {
	const appender = cloudwatch(config, dummyLayout);
	const startTime = Date.now();

	// NOTE: batch is pushed after 10 events
	for (let i = 0; i < 5; i++) {
		appender(logEvent);
	}
	// NOTE: wait for 1.5 second for buffer timeout
	await sleep(1_500);

	// NOTE: fetch log events, if events are not appearing, increase sleep duration
	const data = await cloudwatchClient.getLogEvents({
		startTime: startTime,
		logStreamName: config.logStreamName,
		logGroupName: config.logGroupName,
	});
	assert.equal(data.events?.length, 5);

	for (const e of data.events) {
		assert.deepEqual(e.message, "test");
	}
});
