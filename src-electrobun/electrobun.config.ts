import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "solid-app",
		identifier: "solidapp.electrobun.dev",
		version: "0.0.1",
	},
	build: {
		copy: {
			"../shared/db-schema.sql": "bun/db-schema.sql",
		"../frontend/dist-webview/index.html": "views/mainview/index.html",
			"../frontend/dist-webview/assets": "views/mainview/assets",
			"../frontend/dist-webview/kasir.wasm": "views/mainview/kasir.wasm",
		},
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
