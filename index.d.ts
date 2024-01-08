import { CreateLogStreamRequest } from "@aws-sdk/client-cloudwatch-logs";
import { RegionInputConfig } from "@smithy/config-resolver/dist-types/regionConfig/resolveRegionConfig";
import { AwsCredentialIdentity } from "@smithy/types/dist-types/identity/awsCredentialIdentity";
import { AppenderFunction, LayoutFunction } from "log4js";

declare function cloudwatch(config: Config, layout: LayoutFunction): AppenderFunction;

declare class ConfigError extends Error {
	name: string;
	cause: any;
	constructor(cause: any, msg?: string);
}

export type Config =
	& {
		/**
		 * Maximum number of log events to include in a single batch when sending.
		 * Once the batch size is reached, it will be sent to CloudWatch.
		 */
		batchSize: number;
		/**
		 * Maximum time (in milliseconds) to wait before sending a batch of logs,
		 * regardless of the batch size. If the timeout is reached before the batch
		 * size is met, the logs will be sent.
		 */
		bufferTimeout: number;
		//
		// createLogStream: boolean;
		// createLogGroup: boolean;
	}
	& CreateLogStreamRequest
	& Pick<RegionInputConfig, "region">
	& Pick<AwsCredentialIdentity, "accessKeyId" | "secretAccessKey">;

export type CloudwatchAppender = {
	type: "log4js-appender-cloudwatch";
} & Config;

declare module "log4js" {
	interface Appenders {
		CloudwatchAppender: CloudwatchAppender;
	}
}
