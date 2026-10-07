CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`cost` real NOT NULL,
	`created` text NOT NULL,
	`note` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`created` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`target` text NOT NULL,
	`source` text NOT NULL,
	`created` text NOT NULL,
	`payload` text NOT NULL,
	`analysis` text
);
